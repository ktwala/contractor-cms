import { Injectable, NotFoundException } from '@nestjs/common';
import { Country } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  StatutoryBootstrapReadinessService,
  type StatutoryBootstrapEvaluationData,
} from '../statutory-readiness/statutory-bootstrap-readiness.service';
import {
  BlockingReason,
  NextRecommendedAction,
  PayrollReadinessResponse,
} from './payroll-readiness.types';

@Injectable()
export class PayrollReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly statutoryBootstrapReadiness: StatutoryBootstrapReadinessService,
  ) {}

  async getPayGroupReadiness(payGroupId: string): Promise<PayrollReadinessResponse> {
    const pg = await this.prisma.payGroup.findUnique({
      where: { id: payGroupId },
      include: { legalEntity: true },
    });
    if (!pg) throw new NotFoundException('Pay group not found');

    const [
      workforceCount,
      eligibleEmployeeIds,
      periodsCount,
      openingBalancesCount,
    ] = await Promise.all([
      this.countWorkforce(payGroupId),
      this.getEligibleEmployeeIds(payGroupId),
      this.countPeriods(payGroupId),
      this.countOpeningBalances(payGroupId),
    ]);

    const eligibleEmployeeCount = eligibleEmployeeIds.length;

    const [missingCompensationCount, missingBankCount, missingTaxIdentityCount, missingTaxNumberCount] =
      eligibleEmployeeCount > 0
        ? await Promise.all([
            this.countMissingCompensation(eligibleEmployeeIds),
            this.countMissingBankAccounts(eligibleEmployeeIds),
            this.countMissingTaxIdentity(eligibleEmployeeIds),
            this.countMissingTaxNumbers(eligibleEmployeeIds),
          ])
        : [0, 0, 0, 0];

    const workforceImported = workforceCount > 0;
    const periodsGenerated = periodsCount > 0;
    const openingBalancesLoaded = openingBalancesCount > 0;
    const openingBalancesRequired = false;

    const missingEligibilityCount = workforceImported
      ? Math.max(0, workforceCount - eligibleEmployeeCount)
      : 0;

    const payrollSupplementalReady =
      eligibleEmployeeCount > 0 &&
      missingCompensationCount === 0 &&
      missingBankCount === 0 &&
      missingTaxIdentityCount === 0 &&
      missingTaxNumberCount === 0 &&
      missingEligibilityCount === 0;

    const baseBlockingReasons = this.buildBlockingReasons({
      workforceImported,
      payrollSupplementalReady,
      openingBalancesRequired,
      openingBalancesLoaded,
      periodsGenerated,
      eligibleEmployeeCount,
      missingCompensationCount,
      missingBankCount,
      missingTaxIdentityCount,
      missingTaxNumberCount,
      missingEligibilityCount,
    });

    const country = pg.country as Country;
    const statutoryEvalCountry =
      country === Country.ZA || country === Country.LS ? country : null;
    let statutoryBootstrap: PayrollReadinessResponse['statutoryBootstrap'];
    const statutoryBlocking: BlockingReason[] = [];

    if (statutoryEvalCountry) {
      const asOf = new Date();
      const evalData = await this.statutoryBootstrapReadiness.evaluate(statutoryEvalCountry, asOf);
      statutoryBootstrap = {
        asOf: evalData.as_of,
        countryCode: evalData.country,
        packRegistryReady: evalData.pack_registry.ready,
        payeTaxTableReady: evalData.paye_tax_table.ready,
        statutoryConfigsReady: evalData.statutory_configs.ready,
        snapshotEngineReady: evalData.readiness.snapshot_engine_ready,
        operatorBootstrapComplete: evalData.readiness.operator_bootstrap_complete,
      };
      statutoryBlocking.push(...this.buildStatutoryBlockingReasons(evalData));
    }

    const blockingReasons = [...baseBlockingReasons, ...statutoryBlocking];

    const canCreatePayrun =
      periodsGenerated && eligibleEmployeeCount > 0 && blockingReasons.length === 0;

    const nextRecommendedAction = this.determineNextAction(blockingReasons, canCreatePayrun);

    const readinessPercent = this.calculateReadinessPercent({
      workforceImported,
      payrollSupplementalReady,
      openingBalancesRequired,
      openingBalancesLoaded,
      periodsGenerated,
      eligibleEmployeeCount,
      missingBankCount,
      missingTaxIdentityCount,
      missingTaxNumberCount,
      statutoryBootstrap,
      payGroupCountry: country,
    });

    return {
      payGroupId: pg.id,
      payGroupCode: pg.code,
      countryCode: pg.country,
      currencyCode: pg.currency,
      frequency: pg.frequency,
      readinessPercent,
      workforceImported,
      payrollSupplementalReady,
      openingBalancesRequired,
      openingBalancesLoaded,
      periodsGenerated,
      eligibleEmployeeCount,
      missingBankCount,
      missingTaxIdentityCount,
      missingTaxNumberCount,
      missingCompensationCount,
      missingEligibilityCount,
      canCreatePayrun,
      blockingReasons,
      nextRecommendedAction,
      ...(statutoryBootstrap !== undefined ? { statutoryBootstrap } : {}),
    };
  }

  private buildStatutoryBlockingReasons(evalData: StatutoryBootstrapEvaluationData): BlockingReason[] {
    const out: BlockingReason[] = [];
    if (!evalData.pack_registry.ready) {
      out.push({
        code: 'MISSING_COMPUTE_PACK',
        message:
          "No active compute pack (pack_registry) for this country on today's date. Check prisma/seeds/tax-tables.seed.ts and docs/payroll/TAX_TABLE_GOVERNANCE_RUNBOOK.md.",
      });
    }
    if (!evalData.paye_tax_table.ready) {
      out.push({
        code: 'MISSING_PAYE_TAX_TABLE',
        message:
          'No active PAYE TaxTableSet for this country. Seed tax tables or publish via Tax Table Authoring (see runbook).',
      });
    }
    if (evalData.country === Country.ZA && !evalData.statutory_configs.ready) {
      out.push({
        code: 'INCOMPLETE_STATUTORY_BOOTSTRAP',
        message:
          'ZA statutory configs (UIF, SDL, MTC) are not all active for today. Use Admin → Statutory Config or tax-tables seed.',
      });
    }
    return out;
  }

  private async countWorkforce(payGroupId: string): Promise<number> {
    return this.prisma.employment.count({
      where: {
        payGroupId,
        employee: { status: 'ACTIVE' },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
    });
  }

  private async getEligibleEmployeeIds(payGroupId: string): Promise<string[]> {
    const employments = await this.prisma.employment.findMany({
      where: {
        payGroupId,
        employee: { status: 'ACTIVE' },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    return employments.map((e) => e.employeeId);
  }

  private async countPeriods(payGroupId: string): Promise<number> {
    const currentYear = new Date().getFullYear();
    return this.prisma.payPeriod.count({
      where: {
        payGroupId,
        year: { gte: currentYear },
      },
    });
  }

  private async countOpeningBalances(payGroupId: string): Promise<number> {
    const employeeIds = await this.getEligibleEmployeeIds(payGroupId);
    if (employeeIds.length === 0) return 0;
    return this.prisma.employeePayrollOpeningBalance.count({
      where: { employeeId: { in: employeeIds } },
    });
  }

  private async countMissingCompensation(employeeIds: string[]): Promise<number> {
    const withComp = await this.prisma.compensation.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const withCompSet = new Set(withComp.map((c) => c.employeeId));
    return employeeIds.filter((id) => !withCompSet.has(id)).length;
  }

  private async countMissingBankAccounts(employeeIds: string[]): Promise<number> {
    const withBank = await this.prisma.bankAccount.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const withBankSet = new Set(withBank.map((b) => b.employeeId));
    return employeeIds.filter((id) => !withBankSet.has(id)).length;
  }

  private async countMissingTaxIdentity(employeeIds: string[]): Promise<number> {
    const withTax = await this.prisma.taxProfile.findMany({
      where: { employeeId: { in: employeeIds } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const withTaxSet = new Set(withTax.map((t) => t.employeeId));
    return employeeIds.filter((id) => !withTaxSet.has(id)).length;
  }

  private async countMissingTaxNumbers(employeeIds: string[]): Promise<number> {
    const withTaxNumber = await this.prisma.taxProfile.findMany({
      where: { employeeId: { in: employeeIds }, tin: { not: null } },
      select: { employeeId: true },
      distinct: ['employeeId'],
    });
    const withTaxNumberSet = new Set(withTaxNumber.map((t) => t.employeeId));
    return employeeIds.filter((id) => !withTaxNumberSet.has(id)).length;
  }

  private buildBlockingReasons(checks: {
    workforceImported: boolean;
    payrollSupplementalReady: boolean;
    openingBalancesRequired: boolean;
    openingBalancesLoaded: boolean;
    periodsGenerated: boolean;
    eligibleEmployeeCount: number;
    missingCompensationCount: number;
    missingBankCount: number;
    missingTaxIdentityCount: number;
    missingTaxNumberCount: number;
    missingEligibilityCount: number;
  }): BlockingReason[] {
    const reasons: BlockingReason[] = [];

    if (!checks.workforceImported) {
      reasons.push({
        code: 'MISSING_WORKFORCE',
        message: 'No active workforce records exist for this pay group.',
      });
    }

    if (checks.workforceImported && checks.missingCompensationCount > 0) {
      reasons.push({
        code: 'MISSING_COMPENSATION',
        message: `${checks.missingCompensationCount} eligible employee(s) have no compensation records.`,
      });
    }

    if (checks.workforceImported && checks.missingBankCount > 0) {
      reasons.push({
        code: 'MISSING_BANK_ACCOUNTS',
        message: `${checks.missingBankCount} eligible employee(s) have no bank account.`,
      });
    }

    if (checks.workforceImported && checks.missingTaxIdentityCount > 0) {
      reasons.push({
        code: 'MISSING_TAX_IDENTITY',
        message: `${checks.missingTaxIdentityCount} eligible employee(s) have no tax identity configured.`,
      });
    }

    if (checks.workforceImported && checks.missingTaxNumberCount > 0) {
      reasons.push({
        code: 'MISSING_TAX_NUMBERS',
        message: `${checks.missingTaxNumberCount} eligible employee(s) have incomplete tax numbers.`,
      });
    }

    if (checks.openingBalancesRequired && !checks.openingBalancesLoaded) {
      reasons.push({
        code: 'OPENING_BALANCES_REQUIRED',
        message: 'Opening balances have not been loaded for the current tax year.',
      });
    }

    if (!checks.periodsGenerated) {
      reasons.push({
        code: 'NO_PERIODS',
        message: 'No payroll periods have been generated for this pay group.',
      });
    }

    if (checks.workforceImported && checks.eligibleEmployeeCount === 0) {
      reasons.push({
        code: 'NO_ELIGIBLE_EMPLOYEES',
        message: 'No eligible employees were found for this pay group.',
      });
    }

    return reasons;
  }

  private determineNextAction(
    reasons: BlockingReason[],
    canCreate: boolean,
  ): NextRecommendedAction {
    if (canCreate) return 'CREATE_PAYRUN';
    if (reasons.length === 0) return 'CREATE_PAYRUN';

    const code = reasons[0].code;
    switch (code) {
      case 'MISSING_WORKFORCE':
        return 'FIX_WORKFORCE';
      case 'MISSING_COMPENSATION':
      case 'MISSING_BANK_ACCOUNTS':
      case 'MISSING_TAX_IDENTITY':
      case 'MISSING_TAX_NUMBERS':
      case 'MISSING_PAYROLL_ELIGIBILITY':
        return 'IMPORT_PAYROLL_SUPPLEMENTAL';
      case 'OPENING_BALANCES_REQUIRED':
        return 'IMPORT_OPENING_BALANCES';
      case 'NO_PERIODS':
        return 'GENERATE_PERIODS';
      case 'NO_ELIGIBLE_EMPLOYEES':
        return 'FIX_PAYROLL_ELIGIBILITY';
      case 'MISSING_COMPUTE_PACK':
      case 'MISSING_PAYE_TAX_TABLE':
      case 'INCOMPLETE_STATUTORY_BOOTSTRAP':
        return 'STATUTORY_BOOTSTRAP';
      default:
        return 'CREATE_PAYRUN';
    }
  }

  private calculateReadinessPercent(checks: {
    workforceImported: boolean;
    payrollSupplementalReady: boolean;
    openingBalancesRequired: boolean;
    openingBalancesLoaded: boolean;
    periodsGenerated: boolean;
    eligibleEmployeeCount: number;
    missingBankCount: number;
    missingTaxIdentityCount: number;
    missingTaxNumberCount: number;
    statutoryBootstrap?: PayrollReadinessResponse['statutoryBootstrap'];
    payGroupCountry: Country;
  }): number {
    const items = [
      checks.workforceImported,
      checks.payrollSupplementalReady,
      !checks.openingBalancesRequired || checks.openingBalancesLoaded,
      checks.periodsGenerated,
      checks.eligibleEmployeeCount > 0,
      checks.missingBankCount === 0,
      checks.missingTaxIdentityCount === 0,
      checks.missingTaxNumberCount === 0,
    ];
    const sb = checks.statutoryBootstrap;
    if (sb) {
      items.push(sb.snapshotEngineReady);
      if (checks.payGroupCountry === Country.ZA) {
        items.push(sb.statutoryConfigsReady);
      }
    }
    const passed = items.filter(Boolean).length;
    return Math.round((passed / items.length) * 100);
  }
}
