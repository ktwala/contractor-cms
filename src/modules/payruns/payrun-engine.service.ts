import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { SouthAfricaComputePack } from '../../country-packs/south-africa/south-africa-compute.pack';
import { LesothoComputePack } from '../../country-packs/lesotho/lesotho-compute.pack';
import {
  PayrollComputeContext,
  EmployeeComputeInput,
  PayItemInput,
  ComputeResult,
  ICountryPayrollPack,
} from '../../country-packs/interfaces/compute-contract.interface';
import { PayRunStatus, PayItemType, Country, PayFrequency } from '../../common/dto/enums.dto';
import { format, differenceInYears } from 'date-fns';
import {
  FormulaEvaluationService,
  FormulaContext,
  FormulaPayItem,
} from './formula-evaluation.service';

/**
 * PayRun Engine Service
 *
 * Orchestrates payroll calculation using country packs:
 * 1. Build compute context from snapshot data
 * 2. Call country pack validate() → compute() → post_process()
 * 3. Persist results to database
 */
@Injectable()
export class PayrunEngineService {
  private readonly logger = new Logger(PayrunEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly zaPack: SouthAfricaComputePack,
    private readonly lsPack: LesothoComputePack,
    private readonly formulaService: FormulaEvaluationService,
  ) {}

  /**
   * Execute full payroll calculation using country pack
   */
  async calculate(
    payrunId: string,
    mode: 'FULL' | 'PARTIAL' = 'FULL',
    employeeIds?: string[],
    userId?: string,
  ): Promise<{ payrun_id: string; status: string; results_count: number }> {
    // 1. Load payrun with context and employees
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { include: { legalEntity: true } },
        context: true,
        payRunEmployees: {
          where: { included: true },
          include: { employee: true },
        },
      },
    });

    if (!payrun) {
      throw new BadRequestException({
        code: 'PAYRUN_NOT_FOUND',
        message: `PayRun ${payrunId} not found`,
      });
    }

    if (!payrun.context) {
      throw new BadRequestException({
        code: 'NO_CONTEXT',
        message: 'PayRun must be snapshotted before calculation',
      });
    }

    const allowedStates = [PayRunStatus.SNAPSHOT, PayRunStatus.CALCULATED];
    if (!allowedStates.includes(payrun.status as PayRunStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `PayRun must be in SNAPSHOT or CALCULATED status. Current: ${payrun.status}`,
      });
    }

    if (!payrun.payRunEmployees?.length) {
      throw new BadRequestException({
        code: 'NO_PAYRUN_EMPLOYEES',
        message:
          'Cannot calculate: the payrun employee register is empty. Run snapshot when at least one employee is eligible for this pay group and period.',
        details: { payrunId },
      });
    }

    // 2. Update status to CALCULATING
    await this.prisma.payRun.update({
      where: { id: payrunId },
      data: { status: PayRunStatus.CALCULATING },
    });

    try {
      // 3. Build compute context
      let ctx: PayrollComputeContext;
      try {
        ctx = await this.buildComputeContext(payrun, employeeIds);
      } catch (error) {
        this.logger.error(`Failed to build compute context for payrun ${payrunId}:`, error);
        throw new BadRequestException({
          code: 'CONTEXT_BUILD_FAILED',
          message: `Failed to build compute context: ${error.message}`,
          details: { originalError: error.message },
        });
      }

      // 4. Get the appropriate country pack
      const pack = this.getCountryPack(payrun.context.country as Country);

      this.logger.log(`Calculating payrun ${payrunId} with ${pack.pack_version}`);

      // 5. Validate
      let validation;
      try {
        validation = await pack.validate(ctx);
      } catch (error) {
        this.logger.error(`Country pack validation failed for payrun ${payrunId}:`, error);
        throw new BadRequestException({
          code: 'VALIDATION_ERROR',
          message: `Country pack validation encountered an error: ${error.message}`,
          details: { country: payrun.context.country },
        });
      }

      if (!validation.valid) {
        throw new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: 'Payrun validation failed',
          errors: validation.errors,
        });
      }

      if (validation.warnings && validation.warnings.length > 0) {
        this.logger.warn(`Validation warnings for payrun ${payrunId}:`, validation.warnings);
      }

      // 6. Compute
      let result: ComputeResult;
      try {
        result = await pack.compute(ctx);
        if (!result || !result.employee_results) {
          throw new Error('Country pack returned invalid result structure');
        }
        if (result.employee_results.length === 0) {
          throw new BadRequestException({
            code: 'NO_CALCULATION_RESULTS',
            message:
              'Payroll computation produced no employee results. The payrun register may be empty or the compute pack returned no rows.',
            details: { payrunId, registerCount: ctx.employees.length },
          });
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        this.logger.error(`Country pack compute failed for payrun ${payrunId}:`, error);
        throw new BadRequestException({
          code: 'COMPUTE_FAILED',
          message: `Payroll computation failed: ${error.message}`,
          details: {
            country: payrun.context.country,
            packVersion: pack.pack_version,
            employeeCount: ctx.employees.length,
          },
        });
      }

      // 7. Post-process
      let postResult;
      try {
        postResult = await pack.post_process(ctx, result);
      } catch (error) {
        this.logger.error(`Country pack post-processing failed for payrun ${payrunId}:`, error);
        throw new BadRequestException({
          code: 'POST_PROCESS_FAILED',
          message: `Post-processing failed: ${error.message}`,
          details: { country: payrun.context.country },
        });
      }

      // 8. Persist results
      try {
        await this.persistResults(payrunId, result, postResult);
      } catch (error) {
        this.logger.error(`Failed to persist results for payrun ${payrunId}:`, error);
        throw new BadRequestException({
          code: 'PERSIST_FAILED',
          message: `Failed to save calculation results: ${error.message}`,
          details: { resultCount: result.employee_results.length },
        });
      }

      // 9. Update status to CALCULATED
      await this.prisma.payRun.update({
        where: { id: payrunId },
        data: {
          status: PayRunStatus.CALCULATED,
          lastCalculatedAt: new Date(),
        },
      });

      // 10. Audit log
      await this.auditService.log({
        userId,
        action: 'CALCULATE',
        entityType: 'PayRun',
        entityId: payrunId,
        newValue: {
          pack_version: pack.pack_version,
          employee_count: result.employee_results.length,
          summary: postResult.summary,
        },
      });

      return {
        payrun_id: payrunId,
        status: PayRunStatus.CALCULATED,
        results_count: result.employee_results.length,
      };
    } catch (error) {
      // Revert to SNAPSHOT on failure
      await this.prisma.payRun.update({
        where: { id: payrunId },
        data: { status: PayRunStatus.SNAPSHOT },
      });
      throw error;
    }
  }

  /**
   * Build PayrollComputeContext from payrun and snapshot data
   */
  private async buildComputeContext(
    payrun: any,
    employeeIds?: string[],
  ): Promise<PayrollComputeContext> {
    const context = payrun.context;
    const taxTableData = context.taxTable as any;
    const country = context.country as Country;

    // Filter employees if partial calculation
    let employees = payrun.payRunEmployees;
    if (employeeIds && employeeIds.length > 0) {
      employees = employees.filter((pre: any) => employeeIds.includes(pre.employeeId));
    }

    // Load line item inputs for this payrun
    const lineItemInputs = await this.prisma.lineItemInput.findMany({
      where: { payrunId: payrun.id },
      include: { payItem: true },
    });

    // Load formula-based pay items for this country/pay group
    const formulaPayItems = await this.formulaService.loadFormulaPayItems(
      country,
      payrun.payGroupId,
    );

    this.logger.debug(
      `Loaded ${formulaPayItems.length} formula-based pay items for ${country}`,
    );

    // Map employees to compute input format
    const employeeInputs: EmployeeComputeInput[] = [];

    for (const pre of employees) {
      const snapshot = pre.snapshotData as any;
      const empLineItems = lineItemInputs.filter((li: any) => li.employeeId === pre.employeeId);

      // Calculate age from national ID (ZA format: YYMMDD...)
      let age = 30; // Default age
      if (snapshot.employee?.national_id) {
        try {
          const nationalId = snapshot.employee.national_id;
          if (nationalId.length < 6) {
            throw new Error(`National ID too short: ${nationalId.length} characters`);
          }

          const birthYearPrefix = parseInt(nationalId.substring(0, 2), 10);
          const birthMonth = parseInt(nationalId.substring(2, 4), 10);
          const birthDay = parseInt(nationalId.substring(4, 6), 10);

          if (isNaN(birthYearPrefix) || isNaN(birthMonth) || isNaN(birthDay)) {
            throw new Error('Invalid date components in national ID');
          }

          if (birthMonth < 1 || birthMonth > 12 || birthDay < 1 || birthDay > 31) {
            throw new Error(`Invalid date in national ID: month=${birthMonth}, day=${birthDay}`);
          }

          const birthYear = birthYearPrefix > 50 ? 1900 + birthYearPrefix : 2000 + birthYearPrefix;
          const birthDate = new Date(birthYear, birthMonth - 1, birthDay);

          if (isNaN(birthDate.getTime())) {
            throw new Error('Invalid birth date calculated from national ID');
          }

          age = differenceInYears(new Date(), birthDate);

          if (age < 0 || age > 120) {
            throw new Error(`Calculated age out of valid range: ${age}`);
          }
        } catch (error) {
          this.logger.warn(
            `Failed to parse age from national ID for employee ${pre.employeeId}: ${error.message}. Using default age.`,
          );
          age = 30; // Fallback to default
        }
      }

      // Build pay items from snapshot + line item inputs
      const payItems: PayItemInput[] = [];

      // Add base salary as BASIC earning
      const baseSalary = snapshot.compensation?.base_salary || 0;
      if (baseSalary > 0) {
        payItems.push({
          code: 'BASIC',
          name: 'Basic Salary',
          type: 'EARNING',
          amount: baseSalary,
          is_taxable: true,
          classification: 'BASIC_SALARY',
        });
      }

      // Add line item inputs (overtime, bonuses, etc.)
      for (const input of empLineItems) {
        const payItem = input.payItem;
        const classification = this.mapPayItemToClassification(payItem.code, payItem.type);

        payItems.push({
          code: payItem.code,
          name: payItem.name,
          type: this.mapPayItemType(payItem.type),
          amount: Number(input.amount),
          is_taxable: payItem.taxable,
          classification,
          meta: input.meta as Record<string, any>,
        });
      }

      // Build formula context from current pay items
      const formulaContext: FormulaContext = {
        BASIC: baseSalary,
      };

      // Add line item amounts to context
      for (const item of payItems) {
        formulaContext[item.code] = item.amount;
      }

      // Calculate gross for formula context (sum of all earnings)
      formulaContext.GROSS = payItems
        .filter((pi) => pi.type === 'EARNING')
        .reduce((sum, pi) => sum + pi.amount, 0);

      // Evaluate formula-based pay items
      let evaluatedItems = [];
      try {
        evaluatedItems = this.formulaService.evaluateFormulas(
          formulaPayItems,
          formulaContext,
          country,
        );
      } catch (error) {
        this.logger.error(
          `Failed to evaluate formulas for employee ${pre.employeeId}: ${error.message}`,
        );
        throw new BadRequestException({
          code: 'FORMULA_EVALUATION_FAILED',
          message: `Formula evaluation failed for employee ${pre.employeeId}: ${error.message}`,
          details: {
            employeeId: pre.employeeId,
            formulaCount: formulaPayItems.length,
          },
        });
      }

      // Add evaluated formula items to pay items (avoiding duplicates)
      for (const evalItem of evaluatedItems) {
        // Skip if this code already exists from line item inputs
        if (payItems.some((pi) => pi.code === evalItem.code)) {
          this.logger.debug(
            `Skipping formula item ${evalItem.code} - already provided as line item input`,
          );
          continue;
        }

        if (isNaN(evalItem.amount) || !isFinite(evalItem.amount)) {
          this.logger.warn(
            `Invalid formula result for ${evalItem.code}: ${evalItem.amount}. Skipping.`,
          );
          continue;
        }

        payItems.push({
          code: evalItem.code,
          name: evalItem.name,
          type: this.mapPayItemType(evalItem.type),
          amount: evalItem.amount,
          is_taxable: evalItem.is_taxable,
          classification: evalItem.classification as any,
          meta: {
            source: 'formula',
            formula_trace: evalItem.formula_trace,
          },
        });
      }

      employeeInputs.push({
        employee_id: pre.employeeId,
        employment: {
          employment_type: snapshot.employment?.employment_type || 'PERMANENT',
          cost_center: snapshot.employment?.cost_center,
          department: snapshot.employment?.department,
          job_title: snapshot.employment?.job_title,
          start_date: snapshot.employment?.effective_from || snapshot.employee?.hire_date,
        },
        tax_profile: {
          residency_status: snapshot.tax_profile?.residency_status || 'RESIDENT',
          tax_number: snapshot.tax_profile?.tin,
          age,
          meta: {
            medical_scheme: snapshot.tax_profile?.medical_scheme || {},
          },
        },
        inputs: {
          base_salary: baseSalary,
          pay_items: payItems,
        },
        prior_results: snapshot.prior_results,
      });
    }

    // Build tax table context from snapshot (brackets now come from TaxTableSet via PackRouterService)
    const taxBrackets = taxTableData.brackets || [];

    return {
      payrun: {
        payrun_id: payrun.id,
        payrun_type: (payrun.payrunType || 'REGULAR') as any,
        base_payrun_id: payrun.basePayrunId || undefined,
        country: context.country as 'LS' | 'ZA',
        currency: context.currency as 'LSL' | 'ZAR',
        legal_entity_id: context.legalEntityId,
        period: {
          start: format(payrun.periodStart!, 'yyyy-MM-dd'),
          end: format(payrun.periodEnd!, 'yyyy-MM-dd'),
          pay_date: format(payrun.payDate!, 'yyyy-MM-dd'),
          period_type: this.mapFrequencyToPeriodType(payrun.payGroup.frequency),
        },
      },
      tax_tables: {
        effective_from: taxTableData.effective_from,
        brackets: taxBrackets.map((b: any) => ({
          min: b.min ?? b.lower ?? b.from_amount ?? 0,
          max: b.max ?? b.upper ?? b.to_amount ?? null,
          rate: b.rate,
          base_amount: b.base_amount ?? b.base_tax ?? b.baseTax ?? 0,
        })),
        meta: taxTableData.meta || {},
      },
      employees: employeeInputs,
      rules: { ordered: [] },
      rounding_policy: context.roundingPolicy || { mode: 'HALF_UP', decimals: 2 },
    };
  }

  /**
   * Persist compute results to database
   */
  private async persistResults(
    payrunId: string,
    result: ComputeResult,
    postResult: any,
  ): Promise<void> {
    // Get pay item mapping
    const payItems = await this.prisma.payItem.findMany();
    const payItemMap = new Map(payItems.map((pi) => [pi.code, pi]));

    await this.prisma.$transaction(async (tx) => {
      // Delete existing results
      await tx.payLine.deleteMany({
        where: { employeeResult: { payrunId } },
      });
      await tx.employeeResult.deleteMany({
        where: { payrunId },
      });

      // Create new results
      for (const empResult of result.employee_results) {
        const employeeResult = await tx.employeeResult.create({
          data: {
            payrunId,
            employeeId: empResult.employee_id,
            gross: empResult.totals.gross,
            taxableIncome: empResult.totals.taxable_income,
            paye: empResult.totals.paye,
            deductionsTotal:
              empResult.totals.statutory_deductions +
              empResult.totals.other_deductions +
              (empResult.totals.pre_tax_deductions?.total || 0),
            net: empResult.totals.net,
            calculatedAt: new Date(),
            calcTrace: empResult.trace as any,
          },
        });

        // Create pay lines
        for (const line of empResult.lines) {
          const payItem = payItemMap.get(line.code);

          // Skip employer contributions in employee lines
          if (line.type === 'EMPLOYER_CONTRIBUTION') continue;

          await tx.payLine.create({
            data: {
              employeeResultId: employeeResult.id,
              payItemId: payItem?.id || '',
              type: this.mapLineTypeToPayItemType(line.type),
              amount: line.amount,
              meta: (line.trace as any) || undefined,
            } as any,
          });
        }
      }
    });
  }

  /**
   * Get country pack instance
   */
  private getCountryPack(country: Country): ICountryPayrollPack {
    switch (country) {
      case Country.ZA:
        return this.zaPack;
      case Country.LS:
        return this.lsPack;
      default:
        throw new BadRequestException({
          code: 'UNSUPPORTED_COUNTRY',
          message: `No compute pack available for country: ${country}`,
        });
    }
  }

  /**
   * Map pay frequency to period type
   */
  private mapFrequencyToPeriodType(
    frequency: string,
  ): 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY' {
    switch (frequency) {
      case PayFrequency.WEEKLY:
        return 'WEEKLY';
      case PayFrequency.BIWEEKLY:
        return 'BI_WEEKLY';
      case PayFrequency.MONTHLY:
      default:
        return 'MONTHLY';
    }
  }

  /**
   * Map pay item type to compute input type
   */
  private mapPayItemType(type: string): 'EARNING' | 'DEDUCTION' | 'BENEFIT' | 'REIMBURSEMENT' {
    switch (type) {
      case PayItemType.EARNING:
        return 'EARNING';
      case PayItemType.DEDUCTION:
      case PayItemType.TAX:
        return 'DEDUCTION';
      case PayItemType.EMPLOYER_CONTRIB:
        return 'BENEFIT';
      default:
        return 'EARNING';
    }
  }

  /**
   * Map pay item code to classification
   */
  private mapPayItemToClassification(code: string, type: string): any {
    const mapping: Record<string, string> = {
      BASIC: 'BASIC_SALARY',
      OVERTIME: 'OVERTIME',
      COMMISSION: 'COMMISSION',
      BONUS: 'BONUS',
      ALLOWANCE_TRAVEL: 'ALLOWANCE_TAXABLE',
      ALLOWANCE_CELL: 'ALLOWANCE_TAXABLE',
      PENSION_EE: 'RETIREMENT_CONTRIBUTION',
      MEDICAL_AID_EE: 'MEDICAL_AID_CONTRIBUTION',
      LOAN_REPAYMENT: 'OTHER',
    };
    return mapping[code] || 'OTHER';
  }

  /**
   * Map line type to pay item type
   */
  private mapLineTypeToPayItemType(type: string): PayItemType {
    switch (type) {
      case 'EARNING':
        return PayItemType.EARNING;
      case 'DEDUCTION':
        return PayItemType.DEDUCTION;
      case 'TAX':
      case 'STATUTORY':
        return PayItemType.TAX;
      case 'EMPLOYER_CONTRIBUTION':
        return PayItemType.EMPLOYER_CONTRIB;
      default:
        return PayItemType.EARNING;
    }
  }
}
