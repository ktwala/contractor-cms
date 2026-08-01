import {
  Injectable,
  ConflictException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunsService } from './payruns.service';
import { TaxService } from '../tax/tax.service';
import { PayItemsService } from '../pay-items/pay-items.service';
import { PayrunExceptionService } from './exceptions/payrun-exception.service';
import { PayRunStatus, PayItemType, Country } from '../../common/dto/enums.dto';
import Decimal from 'decimal.js';

interface CalculationContext {
  payrunId: string;
  country: Country;
  taxTable: any;
  packVersion: string;
}

interface EmployeeCalculationResult {
  employeeId: string;
  gross: Decimal;
  taxableIncome: Decimal;
  paye: Decimal;
  deductionsTotal: Decimal;
  net: Decimal;
  lines: {
    payItemId: string;
    code: string;
    type: PayItemType;
    amount: Decimal;
    meta?: any;
  }[];
  trace: any[];
}

@Injectable()
export class PayrunCalculationService {
  private readonly logger = new Logger(PayrunCalculationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly payrunsService: PayrunsService,
    private readonly taxService: TaxService,
    private readonly payItemsService: PayItemsService,
    private readonly payrunExceptionService: PayrunExceptionService,
  ) {}

  async startCalculation(
    payrunId: string,
    mode: 'FULL' | 'PARTIAL',
    recalculateEmployeeIds?: string[],
    userId?: string,
    reason?: string,
  ) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: true,
        context: true,
      },
    });

    if (!payrun) {
      throw new BadRequestException({
        code: 'PAYRUN_NOT_FOUND',
        message: `PayRun with id '${payrunId}' not found`,
      });
    }

    const allowedStates = [PayRunStatus.SNAPSHOT, PayRunStatus.CALCULATED];
    if (!allowedStates.includes(payrun.status as PayRunStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `PayRun must be in SNAPSHOT or CALCULATED status to calculate. Current: ${payrun.status}`,
      });
    }

    if (!payrun.context) {
      throw new BadRequestException({
        code: 'NO_CONTEXT',
        message: 'PayRun must be snapshotted before calculation',
      });
    }

    const registerCount = await this.prisma.payRunEmployee.count({
      where: { payrunId, included: true },
    });
    if (registerCount === 0) {
      throw new BadRequestException({
        code: 'NO_PAYRUN_EMPLOYEES',
        message:
          'Cannot calculate: the payrun employee register is empty. Run snapshot when at least one employee is eligible for this pay group and period.',
        details: { payrunId },
      });
    }

    // Update status to CALCULATING
    await this.prisma.payRun.update({
      where: { id: payrunId },
      data: { status: PayRunStatus.CALCULATING },
    });

    // For now, perform synchronous calculation (in production, this would be async via job queue)
    try {
      await this.performCalculation(payrunId, mode, recalculateEmployeeIds);

      await this.prisma.payRun.update({
        where: { id: payrunId },
        data: {
          status: PayRunStatus.CALCULATED,
          lastCalculatedAt: new Date(),
        },
      });

      await this.auditService.log({
        userId,
        action: 'CALCULATE',
        entityType: 'PayRun',
        entityId: payrunId,
        newValue: { mode, recalculate_employee_ids: recalculateEmployeeIds },
        reason,
      });

      // v1.1: Auto-detect exceptions after successful calculation
      try {
        const detectionResult = await this.payrunExceptionService.detectCalculationExceptions(payrunId);
        this.logger.log(`Post-calc exception detection for ${payrunId}: ${detectionResult.detected} detected, ${detectionResult.summary.criticalOpen} critical`);
      } catch (detectionError) {
        this.logger.warn(`Exception detection failed for payrun ${payrunId}, continuing`, detectionError);
      }

      return {
        job_id: `job_calc_${payrunId}_${Date.now()}`,
        payrun_id: payrunId,
        status: PayRunStatus.CALCULATED,
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

  private async performCalculation(
    payrunId: string,
    mode: 'FULL' | 'PARTIAL',
    recalculateEmployeeIds?: string[],
  ) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        context: true,
        payRunEmployees: {
          where: { included: true },
          include: { employee: true },
        },
      },
    });

    if (!payrun || !payrun.context) {
      throw new BadRequestException({
        code: 'INVALID_PAYRUN',
        message: 'PayRun or context not found',
      });
    }

    const country = payrun.context.country as Country;
    const taxTableData = payrun.context.taxTable as any;

    // Use brackets from snapshot context (populated by PackRouterService during snapshot)
    const snapshotBrackets = taxTableData.brackets || [];
    let taxTable;

    if (snapshotBrackets.length > 0) {
      taxTable = {
        brackets: snapshotBrackets.map((b: any) => ({
          fromAmount: b.min ?? b.from_amount ?? 0,
          toAmount: b.max ?? b.to_amount ?? null,
          rate: b.rate,
          baseTax: b.base_amount ?? b.base_tax ?? b.baseTax ?? 0,
        })),
        meta: taxTableData.meta || {},
      };
    } else {
      try {
        taxTable = await this.taxService.getTaxTable(
          country,
          taxTableData.effective_from,
        );
      } catch (error) {
        throw new BadRequestException({
          code: 'TAX_TABLE_NOT_FOUND',
          message: `No tax brackets available for ${country}. Re-snapshot the payrun to resolve from the latest statutory configuration.`,
          details: { country, effectiveFrom: taxTableData.effective_from },
        });
      }
    }

    if (!taxTable.brackets || taxTable.brackets.length === 0) {
      throw new BadRequestException({
        code: 'INVALID_TAX_TABLE',
        message: `Tax table for ${country} has no brackets. Re-snapshot the payrun to resolve from the latest statutory configuration.`,
        details: { country, tableId: (taxTable as any).id || 'unknown' },
      });
    }

    // Determine which employees to calculate
    let employeesToCalculate = payrun.payRunEmployees;
    if (mode === 'PARTIAL' && recalculateEmployeeIds && recalculateEmployeeIds.length > 0) {
      employeesToCalculate = employeesToCalculate.filter((pre) =>
        recalculateEmployeeIds.includes(pre.employeeId),
      );
    }

    if (employeesToCalculate.length === 0) {
      throw new BadRequestException({
        code: 'NO_EMPLOYEES_TO_CALCULATE',
        message: 'No employees found to calculate',
        details: { mode, recalculateEmployeeIds },
      });
    }

    // Get line item inputs for this payrun
    const lineItemInputs = await this.prisma.lineItemInput.findMany({
      where: { payrunId },
      include: { payItem: true },
    });

    const errors: Array<{ employeeId: string; error: string }> = [];

    // Calculate for each employee
    for (const payrunEmployee of employeesToCalculate) {
      try {
        const result = await this.calculateForEmployee(
          payrunEmployee,
          lineItemInputs.filter((li) => li.employeeId === payrunEmployee.employeeId),
          country,
          taxTable,
        );

        // Save results
        await this.saveEmployeeResult(payrunId, result);
      } catch (error) {
        const errorMessage = `Failed to calculate for employee ${payrunEmployee.employeeId}: ${error.message}`;
        errors.push({
          employeeId: payrunEmployee.employeeId,
          error: errorMessage,
        });
        this.logger.error(errorMessage, error.stack);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        code: 'CALCULATION_ERRORS',
        message: `Failed to calculate ${errors.length} out of ${employeesToCalculate.length} employees`,
        details: {
          failedCount: errors.length,
          totalCount: employeesToCalculate.length,
          errors: errors.slice(0, 10),
        },
      });
    }
  }

  private async calculateForEmployee(
    payrunEmployee: any,
    lineItemInputs: any[],
    country: Country,
    taxTable: any,
  ): Promise<EmployeeCalculationResult> {
    const snapshotData = payrunEmployee.snapshotData as any;
    const trace: any[] = [];

    // Get base salary from snapshot
    const baseSalary = snapshotData?.compensation?.base_salary
      ? new Decimal(snapshotData.compensation.base_salary)
      : new Decimal(0);

    trace.push({
      step: 'base_salary',
      value: baseSalary.toNumber(),
      source: 'compensation_snapshot',
    });

    // Calculate earnings
    const earnings: { payItemId: string; code: string; amount: Decimal; meta?: any }[] = [];
    let gross = baseSalary;

    // Add base salary as BASIC earning
    const basicPayItem = await this.prisma.payItem.findFirst({
      where: { code: 'BASIC' },
    });

    if (!basicPayItem) {
      throw new BadRequestException({
        code: 'BASIC_PAY_ITEM_NOT_FOUND',
        message: 'BASIC pay item not configured in the system',
        details: { employeeId: payrunEmployee.employeeId },
      });
    }

    earnings.push({
      payItemId: basicPayItem.id,
      code: 'BASIC',
      amount: baseSalary,
    });

    // Add variable pay inputs
    for (const input of lineItemInputs) {
      if (input.payItem.type === PayItemType.EARNING) {
        const amount = new Decimal(input.amount.toString());
        earnings.push({
          payItemId: input.payItemId,
          code: input.payItem.code,
          amount,
          meta: input.meta,
        });
        gross = gross.plus(amount);

        trace.push({
          step: 'add_earning',
          code: input.payItem.code,
          amount: amount.toNumber(),
        });
      }
    }

    trace.push({
      step: 'gross_calculation',
      gross: gross.toNumber(),
    });

    // Calculate taxable income (simplified - would use rules engine in production)
    let taxableIncome = gross;

    // Deduct pension contributions if applicable (simplified)
    const pensionDeduction = gross.times(0.075); // 7.5% pension example
    taxableIncome = taxableIncome.minus(pensionDeduction);

    trace.push({
      step: 'pension_deduction',
      amount: pensionDeduction.toNumber(),
      taxable_income: taxableIncome.toNumber(),
    });

    // Calculate PAYE
    let paye: Decimal;
    let taxTrace: any[];
    try {
      const payeResult = this.taxService.calculatePAYE(
        taxableIncome,
        taxTable.brackets,
        taxTable.meta,
      );
      paye = payeResult.paye;
      taxTrace = payeResult.trace;
    } catch (error) {
      throw new BadRequestException({
        code: 'PAYE_CALCULATION_FAILED',
        message: `Failed to calculate PAYE for employee: ${error.message}`,
        details: {
          employeeId: payrunEmployee.employeeId,
          taxableIncome: taxableIncome.toNumber(),
        },
      });
    }

    trace.push(...taxTrace);

    // Calculate other deductions from inputs
    let deductionsTotal = paye.plus(pensionDeduction);
    const deductions: { payItemId: string; code: string; amount: Decimal; meta?: any }[] = [];

    for (const input of lineItemInputs) {
      if (input.payItem.type === PayItemType.DEDUCTION) {
        const amount = new Decimal(input.amount.toString());
        deductions.push({
          payItemId: input.payItemId,
          code: input.payItem.code,
          amount,
          meta: input.meta,
        });
        deductionsTotal = deductionsTotal.plus(amount);

        trace.push({
          step: 'add_deduction',
          code: input.payItem.code,
          amount: amount.toNumber(),
        });
      }
    }

    // Calculate net pay
    const net = gross.minus(deductionsTotal);

    trace.push({
      step: 'net_calculation',
      gross: gross.toNumber(),
      deductions: deductionsTotal.toNumber(),
      net: net.toNumber(),
    });

    // Build pay lines
    const lines = [
      ...earnings.map((e) => ({
        payItemId: e.payItemId,
        code: e.code,
        type: PayItemType.EARNING,
        amount: e.amount,
        meta: e.meta,
      })),
      ...deductions.map((d) => ({
        payItemId: d.payItemId,
        code: d.code,
        type: PayItemType.DEDUCTION,
        amount: d.amount,
        meta: d.meta,
      })),
    ];

    // Add PAYE as a pay line
    const payePayItem = await this.prisma.payItem.findFirst({
      where: { code: 'PAYE' },
    });

    if (!payePayItem) {
      throw new BadRequestException({
        code: 'PAYE_PAY_ITEM_NOT_FOUND',
        message: 'PAYE pay item not configured in the system',
        details: { employeeId: payrunEmployee.employeeId },
      });
    }

    lines.push({
      payItemId: payePayItem.id,
      code: 'PAYE',
      type: PayItemType.TAX,
      amount: paye,
      meta: {},
    });

    return {
      employeeId: payrunEmployee.employeeId,
      gross,
      taxableIncome,
      paye,
      deductionsTotal,
      net,
      lines,
      trace,
    };
  }

  private async saveEmployeeResult(payrunId: string, result: EmployeeCalculationResult) {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Delete existing result
        await tx.employeeResult.deleteMany({
          where: { payrunId, employeeId: result.employeeId },
        });

        // Validate result values before saving
        if (!isFinite(result.gross.toNumber()) || result.gross.isNaN()) {
          throw new Error(`Invalid gross amount: ${result.gross}`);
        }
        if (!isFinite(result.net.toNumber()) || result.net.isNaN()) {
          throw new Error(`Invalid net amount: ${result.net}`);
        }

        // Create new result
        const employeeResult = await tx.employeeResult.create({
          data: {
            payrunId,
            employeeId: result.employeeId,
            gross: result.gross.toDecimalPlaces(2).toNumber(),
            taxableIncome: result.taxableIncome.toDecimalPlaces(2).toNumber(),
            paye: result.paye.toDecimalPlaces(2).toNumber(),
            deductionsTotal: result.deductionsTotal.toDecimalPlaces(2).toNumber(),
            net: result.net.toDecimalPlaces(2).toNumber(),
            calculatedAt: new Date(),
            calcTrace: result.trace,
          },
        });

        // Create pay lines
        for (const line of result.lines) {
          if (!isFinite(line.amount.toNumber()) || line.amount.isNaN()) {
            throw new Error(`Invalid pay line amount for ${line.code}: ${line.amount}`);
          }

          await tx.payLine.create({
            data: {
              employeeResultId: employeeResult.id,
              payItemId: line.payItemId,
              type: line.type,
              amount: line.amount.toDecimalPlaces(2).toNumber(),
              meta: line.meta,
            },
          });
        }
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'SAVE_RESULT_FAILED',
        message: `Failed to save calculation result for employee ${result.employeeId}: ${error.message}`,
        details: { employeeId: result.employeeId },
      });
    }
  }

  async getResults(payrunId: string, offset = 0, limit = 50) {
    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
      include: { employee: true },
      skip: offset,
      take: limit,
      orderBy: { employee: { employeeNo: 'asc' } },
    });

    const total = await this.prisma.employeeResult.count({
      where: { payrunId },
    });

    return {
      items: results.map((r) => ({
        employee_id: r.employeeId,
        gross: Number(r.gross),
        net: Number(r.net),
      })),
      offset,
      limit,
      total,
    };
  }

  async getEmployeeResult(payrunId: string, employeeId: string) {
    const result = await this.prisma.employeeResult.findUnique({
      where: {
        payrunId_employeeId: { payrunId, employeeId },
      },
      include: {
        payLines: {
          include: { payItem: true },
        },
      },
    });

    if (!result) {
      throw new BadRequestException({
        code: 'RESULT_NOT_FOUND',
        message: `Result for employee '${employeeId}' not found in payrun '${payrunId}'`,
      });
    }

    return {
      employee_id: result.employeeId,
      gross: Number(result.gross),
      taxable_income: Number(result.taxableIncome),
      paye: Number(result.paye),
      deductions_total: Number(result.deductionsTotal),
      net: Number(result.net),
      lines: result.payLines.map((pl) => ({
        code: pl.payItem.code,
        type: pl.type,
        amount: Number(pl.amount),
        meta: pl.meta,
      })),
    };
  }

  async getEmployeeTrace(payrunId: string, employeeId: string) {
    const result = await this.prisma.employeeResult.findUnique({
      where: {
        payrunId_employeeId: { payrunId, employeeId },
      },
    });

    if (!result) {
      throw new BadRequestException({
        code: 'RESULT_NOT_FOUND',
        message: `Result for employee '${employeeId}' not found in payrun '${payrunId}'`,
      });
    }

    return {
      payrun_id: payrunId,
      employee_id: employeeId,
      steps: result.calcTrace as any[],
    };
  }
}
