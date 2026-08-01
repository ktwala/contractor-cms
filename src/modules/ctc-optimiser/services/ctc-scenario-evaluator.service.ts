import { Injectable, Logger } from '@nestjs/common';
import { SouthAfricaComputePack } from '../../../country-packs/south-africa/south-africa-compute.pack';
import { LesothoComputePack } from '../../../country-packs/lesotho/lesotho-compute.pack';
import { RoutingResult } from '../../../country-packs/services/pack-router.service';
import {
  PayrollComputeContext,
  PayItemClassification,
} from '../../../country-packs/interfaces/compute-contract.interface';
import { RunCtcOptimiserDto } from '../dto/run-ctc-optimiser.dto';
import {
  CtcScenarioBreakdown,
  CtcScenarioEvaluation,
  MedicalFundingModel,
} from '../domain/ctc-optimiser.types';

/**
 * Thin adapter that bridges CTC scenario breakdowns into the real payroll
 * compute pipeline — no duplicate tax logic. Each scenario is converted to
 * a PayrollComputeContext and passed to the country pack's compute() method.
 */
@Injectable()
export class CtcScenarioEvaluatorService {
  private readonly logger = new Logger(CtcScenarioEvaluatorService.name);

  constructor(
    private readonly zaPack: SouthAfricaComputePack,
    private readonly lsPack: LesothoComputePack,
  ) {}

  async evaluate(params: {
    input: RunCtcOptimiserDto;
    scenario: CtcScenarioBreakdown;
    routing: RoutingResult;
  }): Promise<CtcScenarioEvaluation> {
    const { input, scenario, routing } = params;
    const ctx = this.buildComputeContext(input, scenario, routing);
    const pack = input.countryCode === 'ZA' ? this.zaPack : this.lsPack;

    this.logger.debug(
      `Evaluating scenario via ${pack.pack_version}: basic=${scenario.basicSalary}, travel=${scenario.travelAllowance}`,
    );

    const result = await pack.compute(ctx);
    const emp = result.employee_results[0];

    if (!emp) {
      this.logger.warn('Compute returned no employee results — returning zeros');
      return this.emptyEvaluation();
    }

    const totals = emp.totals;
    const employerContributions = Object.values(result.employer_totals ?? {}).reduce(
      (sum, v) => sum + (v ?? 0),
      0,
    );

    const medicalModel = this.resolveMedicalFundingModel(input);
    const employerMedical = medicalModel === 'EMPLOYER_FUNDED' ? scenario.medicalAidEmployerContribution : 0;

    return this.normalizeOutput({
      taxableIncome: totals.taxable_income,
      paye: totals.paye,
      uif: this.extractLineAmount(emp.lines, 'UIF_EE'),
      netPay: totals.net,
      grossEarnings: totals.gross,
      deductions: totals.statutory_deductions + totals.other_deductions,
      employerCost: totals.gross + employerContributions + employerMedical,
      creditsApplied: this.extractCredits(emp.lines),
      engineOutput: {
        pack_version: pack.pack_version,
        medicalFundingModel: medicalModel,
        totals,
        lines: emp.lines,
        trace: emp.trace,
      },
    });
  }

  private buildComputeContext(
    input: RunCtcOptimiserDto,
    scenario: CtcScenarioBreakdown,
    routing: RoutingResult,
  ): PayrollComputeContext {
    const medicalModel = this.resolveMedicalFundingModel(input);
    const payItems = this.scenarioToPayItems(scenario, medicalModel);
    const taxData = routing.tax_tables.data;
    const now = new Date().toISOString().slice(0, 10);

    return {
      payrun: {
        payrun_id: `ctc-opt-${Date.now()}`,
        payrun_type: 'REGULAR',
        country: input.countryCode as 'ZA' | 'LS',
        currency: input.countryCode === 'ZA' ? 'ZAR' : 'LSL',
        legal_entity_id: input.legalEntityId ?? 'ctc-optimiser-sim',
        period: {
          start: now,
          end: now,
          pay_date: now,
          period_type: 'MONTHLY',
        },
      },
      tax_tables: {
        effective_from: routing.compute_date_value,
        brackets: taxData.brackets.map((b) => ({
          min: b.min,
          max: b.max ?? Infinity,
          rate: b.rate,
          base_amount: b.base_amount,
        })),
        meta: {
          ...(taxData.credits ?? {}),
          ...(taxData.rebates ? { rebates: taxData.rebates } : {}),
          ...(taxData.thresholds ? { thresholds: taxData.thresholds } : {}),
          ...(taxData.periods_per_year ? { periods_per_year: taxData.periods_per_year } : {}),
        },
      },
      employees: [
        {
          employee_id: input.employeeId ?? 'ctc-optimiser-sim',
          employment: {
            employment_type: 'PERMANENT',
            start_date: '2020-01-01',
          },
          tax_profile: {
            residency_status: 'RESIDENT',
            age: (input.employeeContext?.age as number) ?? 35,
            meta: {
              medical_aid_members: input.medicalAid.beneficiaries,
              medical_scheme: {
                main_members: 1,
                dependants: Math.max(0, input.medicalAid.beneficiaries - 1),
              },
            },
          },
          inputs: {
            base_salary: scenario.basicSalary,
            pay_items: payItems,
          },
        },
      ],
      rules: { ordered: [] },
      rounding_policy: { mode: 'HALF_UP', decimals: 2 },
    };
  }

  private scenarioToPayItems(
    scenario: CtcScenarioBreakdown,
    medicalFundingModel: MedicalFundingModel = 'EMPLOYER_FUNDED',
  ): Array<{
    code: string;
    type: 'EARNING' | 'DEDUCTION' | 'BENEFIT' | 'REIMBURSEMENT';
    amount: number;
    is_taxable: boolean;
    classification: PayItemClassification;
  }> {
    const items: Array<{
      code: string;
      type: 'EARNING' | 'DEDUCTION' | 'BENEFIT' | 'REIMBURSEMENT';
      amount: number;
      is_taxable: boolean;
      classification: PayItemClassification;
    }> = [];

    if (scenario.basicSalary > 0) {
      items.push({
        code: 'BASIC_SALARY',
        type: 'EARNING',
        amount: scenario.basicSalary,
        is_taxable: true,
        classification: 'BASIC_SALARY',
      });
    }

    if (scenario.travelAllowance > 0) {
      items.push({
        code: 'TRAVEL_ALLOWANCE',
        type: 'EARNING',
        amount: scenario.travelAllowance,
        is_taxable: true,
        classification: 'ALLOWANCE_TAXABLE',
      });
    }

    if (scenario.reimbursiveTravelNonTaxable > 0) {
      items.push({
        code: 'REIMB_TRAVEL_NON_TAXABLE',
        type: 'REIMBURSEMENT',
        amount: scenario.reimbursiveTravelNonTaxable,
        is_taxable: false,
        classification: 'REIMBURSEMENT',
      });
    }

    if (scenario.otherAllowanceTaxable > 0) {
      items.push({
        code: 'OTHER_ALLOWANCE_TAXABLE',
        type: 'EARNING',
        amount: scenario.otherAllowanceTaxable,
        is_taxable: true,
        classification: 'ALLOWANCE_TAXABLE',
      });
    }

    if (scenario.otherAllowanceNonTaxable > 0) {
      items.push({
        code: 'OTHER_ALLOWANCE_NON_TAXABLE',
        type: 'EARNING',
        amount: scenario.otherAllowanceNonTaxable,
        is_taxable: false,
        classification: 'ALLOWANCE_EXEMPT',
      });
    }

    if (scenario.medicalAidEmployerContribution > 0 && medicalFundingModel === 'EMPLOYEE_PAID') {
      items.push({
        code: 'MEDICAL_AID_CONTRIBUTION',
        type: 'DEDUCTION',
        amount: scenario.medicalAidEmployerContribution,
        is_taxable: false,
        classification: 'MEDICAL_AID_CONTRIBUTION',
      });
    }

    if (scenario.retirementContribution > 0) {
      items.push({
        code: 'RETIREMENT_FUND',
        type: 'DEDUCTION',
        amount: scenario.retirementContribution,
        is_taxable: false,
        classification: 'RETIREMENT_CONTRIBUTION',
      });
    }

    this.assertPayItemContract(scenario, items);
    return items;
  }

  private assertPayItemContract(
    scenario: CtcScenarioBreakdown,
    items: Array<{ code: string; type: string; amount: number }>,
  ): void {
    if (scenario.basicSalary > 0) {
      const hasBasic = items.some(
        (i) => i.code === 'BASIC_SALARY' && i.type === 'EARNING' && i.amount === scenario.basicSalary,
      );
      if (!hasBasic) {
        throw new Error(
          `Pay-item contract violation: scenario.basicSalary is ${scenario.basicSalary} ` +
          `but no matching BASIC_SALARY earning exists in pay_items. ` +
          `The compute pack derives gross from pay_items only — omitting BASIC_SALARY collapses all downstream values.`,
        );
      }
    }
  }

  private resolveMedicalFundingModel(input: RunCtcOptimiserDto): MedicalFundingModel {
    return input.medicalAid.fundingModel ?? 'EMPLOYER_FUNDED';
  }

  private extractLineAmount(lines: Array<{ code: string; amount: number }>, code: string): number {
    return lines.find((l) => l.code === code)?.amount ?? 0;
  }

  private extractCredits(
    lines: Array<{ code: string; amount: number; type: string }>,
  ): Record<string, number> {
    const credits: Record<string, number> = {};
    for (const line of lines) {
      if (line.type === 'TAX' && line.amount < 0) {
        credits[line.code] = Math.abs(line.amount);
      }
    }
    return credits;
  }

  /**
   * Normalize output so pack-specific quirks (NaN, negative net, missing fields)
   * never leak into the optimiser's ranking or UI layer.
   */
  private normalizeOutput(raw: CtcScenarioEvaluation): CtcScenarioEvaluation {
    const safe = (v: number) => (Number.isFinite(v) ? v : 0);
    return {
      taxableIncome: safe(raw.taxableIncome),
      paye: safe(raw.paye),
      uif: safe(raw.uif),
      netPay: safe(raw.netPay),
      grossEarnings: safe(raw.grossEarnings),
      deductions: safe(raw.deductions),
      employerCost: safe(raw.employerCost),
      creditsApplied: raw.creditsApplied ?? {},
      engineOutput: raw.engineOutput ?? {},
    };
  }

  private emptyEvaluation(): CtcScenarioEvaluation {
    return {
      taxableIncome: 0,
      paye: 0,
      uif: 0,
      netPay: 0,
      grossEarnings: 0,
      deductions: 0,
      employerCost: 0,
      creditsApplied: {},
      engineOutput: {},
    };
  }
}
