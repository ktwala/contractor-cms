import {
  Injectable,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunsService, RequestUser } from './payruns.service';
import { EffectiveDatedService } from '../employees/effective-dated.service';
import { TaxService } from '../tax/tax.service';
import { PackRouterService } from '../../country-packs/services/pack-router.service';
import { PayRunStatus, PayRunType, Country, Currency } from '../../common/dto/enums.dto';
import { PreviewPayrunInclusionsDto } from './dto/preview-payrun-inclusions.dto';
import { ConfigService } from '@nestjs/config';

const SNAPSHOT_PREVIEW_ROW_CAP = 150;

type PreviewRow = {
  employee_id: string;
  reason: string;
  /** Populated for UI drill-through (Create Payrun, payrun preview). */
  employee_no?: string;
  first_name?: string;
  last_name?: string;
};

type EmploymentScopeCounts = {
  active_employees: number;
  with_employment_in_pay_group: number;
  with_employment_overlapping_payrun_period: number;
};

@Injectable()
export class PayrunSnapshotService {
  private readonly logger = new Logger(PayrunSnapshotService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly payrunsService: PayrunsService,
    private readonly effectiveDatedService: EffectiveDatedService,
    private readonly taxService: TaxService,
    private readonly packRouter: PackRouterService,
    private readonly configService: ConfigService,
  ) {}

  private summarizeExclusionReasons(excluded: PreviewRow[]): Record<string, number> {
    return excluded.reduce<Record<string, number>>((acc, row) => {
      acc[row.reason] = (acc[row.reason] ?? 0) + 1;
      return acc;
    }, {});
  }

  private capPreviewRows<T extends { employee_id: string }>(rows: T[]): { items: T[]; truncated: boolean } {
    if (rows.length <= SNAPSHOT_PREVIEW_ROW_CAP) {
      return { items: rows, truncated: false };
    }
    return { items: rows.slice(0, SNAPSHOT_PREVIEW_ROW_CAP), truncated: true };
  }

  private async getEmploymentScopeCounts(
    payGroupId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<EmploymentScopeCounts> {
    const [active_employees, with_employment_in_pay_group, with_employment_overlapping_payrun_period] =
      await Promise.all([
        this.prisma.employee.count({ where: { status: 'ACTIVE' } }),
        this.prisma.employee.count({
          where: {
            status: 'ACTIVE',
            employments: { some: { payGroupId } },
          },
        }),
        this.prisma.employee.count({
          where: {
            status: 'ACTIVE',
            employments: {
              some: {
                payGroupId,
                effectiveFrom: { lte: periodEnd },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
              },
            },
          },
        }),
      ]);
    return { active_employees, with_employment_in_pay_group, with_employment_overlapping_payrun_period };
  }

  private buildNoEligibleEmployeesMessage(
    preview: { candidates: PreviewRow[]; excluded: PreviewRow[] },
    employmentScope: EmploymentScopeCounts | null,
    periodLabel: string,
  ): string {
    const { candidates, excluded } = preview;
    const summary = this.summarizeExclusionReasons(excluded);
    const summaryText = Object.entries(summary)
      .map(([reason, n]) => `${n}× ${reason}`)
      .join('; ');

    if (candidates.length === 0 && excluded.length === 0) {
      if (!employmentScope) {
        return `No eligible employees: no ACTIVE employees matched the pay group + period query (${periodLabel}). This payrun may be missing period_start / period_end, or no rows overlap the window.`;
      }
      const { active_employees, with_employment_in_pay_group, with_employment_overlapping_payrun_period } =
        employmentScope;
      if (active_employees === 0) {
        return `No eligible employees: there are no ACTIVE employees in the database (${periodLabel}).`;
      }
      if (with_employment_in_pay_group === 0) {
        return `No eligible employees: ${active_employees} ACTIVE employee(s), but none have an employment row for this pay group (${periodLabel}). Check pay_group_id on employments vs this payrun.`;
      }
      if (with_employment_overlapping_payrun_period === 0) {
        return `No eligible employees: ${with_employment_in_pay_group} ACTIVE employee(s) have this pay group on employment, but effective dates do not overlap the payrun period (${periodLabel}). Adjust employment effectiveFrom / effectiveTo.`;
      }
      return `No eligible employees: eligibility query returned no rows despite ${with_employment_overlapping_payrun_period} overlapping employment(s) (${periodLabel}). Contact engineering with payrun id.`;
    }

    if (candidates.length === 0 && excluded.length > 0) {
      return `No eligible employees: ${excluded.length} employee(s) matched pay group + period, but none passed compensation / bank / tax checks — ${summaryText}.`;
    }

    return `No eligible employees for this pay group and period (${periodLabel}). ${summaryText || 'Adjust workforce data or filters.'}`;
  }

  /**
   * Same inclusion rules as {@link previewInclusions} for an existing payrun, without requiring a payrun row.
   */
  async previewInclusionsBeforeCreate(dto: PreviewPayrunInclusionsDto, user: RequestUser) {
    const resolved = await this.payrunsService.resolvePayrunPeriodForPreview(dto, user);
    const { candidates, excluded } = await this.computeEligibilityForPayGroupPeriod(
      resolved.payGroup.id,
      resolved.periodStart,
      resolved.periodEnd,
    );
    const payGroup = resolved.payGroup;
    const exclusion_summary = excluded.length > 0 ? this.summarizeExclusionReasons(excluded) : undefined;
    const employment_scope =
      candidates.length === 0 && excluded.length === 0
        ? await this.getEmploymentScopeCounts(payGroup.id, resolved.periodStart, resolved.periodEnd)
        : undefined;

    return {
      pay_group: { id: payGroup.id, code: payGroup.code, name: payGroup.name },
      period: {
        period_start: resolved.periodStart.toISOString(),
        period_end: resolved.periodEnd.toISOString(),
        pay_date: resolved.payDate.toISOString(),
      },
      run_type: dto.run_type ?? PayRunType.REGULAR,
      candidates,
      excluded,
      exclusion_summary,
      employment_scope: employment_scope ?? null,
    };
  }

  /** Shared eligibility evaluation used by payrun inclusion preview (draft payrun or pre-create). */
  private async computeEligibilityForPayGroupPeriod(payGroupId: string, periodStart: Date, periodEnd: Date) {
    const employees = await this.prisma.employee.findMany({
      where: {
        status: 'ACTIVE',
        employments: {
          some: {
            payGroupId,
            effectiveFrom: { lte: periodEnd },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: periodStart } }],
          },
        },
      },
      include: {
        employments: {
          where: {
            payGroupId,
          },
        },
        compensations: true,
        bankAccounts: true,
        taxProfiles: true,
      },
    });

    const candidates: PreviewRow[] = [];
    const excluded: PreviewRow[] = [];

    for (const emp of employees) {
      // Inclusion gates (same order as exclusion checks):
      // 1) Compensation — Compensation rows; overlap: effectiveFrom <= periodEnd && (effectiveTo null || >= periodStart)
      // 2) Bank — BankAccount rows on bank_accounts; same overlap rule. No PRIMARY flag: any one overlapping row passes.
      //    Not evaluated: verification status (not on model), payment_method elsewhere.
      // 3) Tax — TaxProfile rows; same overlap rule.
      const hasCompensation = emp.compensations.some(
        (c) =>
          c.effectiveFrom <= periodEnd &&
          (c.effectiveTo === null || c.effectiveTo >= periodStart),
      );

      const hasBankAccount = emp.bankAccounts.some(
        (ba) =>
          ba.effectiveFrom <= periodEnd &&
          (ba.effectiveTo === null || ba.effectiveTo >= periodStart),
      );

      const hasTaxProfile = emp.taxProfiles.some(
        (tp) =>
          tp.effectiveFrom <= periodEnd &&
          (tp.effectiveTo === null || tp.effectiveTo >= periodStart),
      );

      if (!hasCompensation) {
        excluded.push({
          employee_id: emp.id,
          reason: 'No valid compensation record for period',
          employee_no: emp.employeeNo,
          first_name: emp.firstName,
          last_name: emp.lastName,
        });
      } else if (!hasBankAccount) {
        excluded.push({
          employee_id: emp.id,
          reason: 'No valid bank account for period',
          employee_no: emp.employeeNo,
          first_name: emp.firstName,
          last_name: emp.lastName,
        });
      } else if (!hasTaxProfile) {
        excluded.push({
          employee_id: emp.id,
          reason: 'No valid tax profile for period',
          employee_no: emp.employeeNo,
          first_name: emp.firstName,
          last_name: emp.lastName,
        });
      } else {
        candidates.push({
          employee_id: emp.id,
          reason: 'Eligible for payroll',
          employee_no: emp.employeeNo,
          first_name: emp.firstName,
          last_name: emp.lastName,
        });
      }
    }

    return { candidates, excluded };
  }

  async previewInclusions(payrunId: string, filters?: Record<string, any>, user?: RequestUser) {
    if (user) {
      await this.payrunsService.findOne(payrunId, user);
    }
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: {
          include: { legalEntity: true },
        },
      },
    });

    if (!payrun) {
      throw new BadRequestException({
        code: 'PAYRUN_NOT_FOUND',
        message: `PayRun with id '${payrunId}' not found`,
      });
    }

    const { candidates, excluded } = await this.computeEligibilityForPayGroupPeriod(
      payrun.payGroupId,
      payrun.periodStart!,
      payrun.periodEnd!,
    );

    const payGroup = payrun.payGroup;
    const exclusion_summary = excluded.length > 0 ? this.summarizeExclusionReasons(excluded) : undefined;
    const employment_scope =
      candidates.length === 0 && excluded.length === 0 && payrun.periodStart && payrun.periodEnd
        ? await this.getEmploymentScopeCounts(payrun.payGroupId, payrun.periodStart, payrun.periodEnd)
        : undefined;

    return {
      payrun_id: payrunId,
      pay_group: { id: payrun.payGroupId, code: payGroup.code, name: payGroup.name },
      period:
        payrun.periodStart && payrun.periodEnd
          ? {
              period_start: payrun.periodStart.toISOString(),
              period_end: payrun.periodEnd.toISOString(),
              pay_date: payrun.payDate?.toISOString() ?? null,
            }
          : null,
      candidates,
      excluded,
      exclusion_summary,
      employment_scope,
    };
  }

  async snapshot(
    payrunId: string,
    snapshotEffectiveAt: string,
    includeEmployeeIds?: string[],
    excludeEmployeeIds?: string[],
    user?: RequestUser,
    reason?: string,
  ) {
    if (user) {
      await this.payrunsService.findOne(payrunId, user);
    }
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: {
          include: { legalEntity: true },
        },
      },
    });

    if (!payrun) {
      throw new BadRequestException({
        code: 'PAYRUN_NOT_FOUND',
        message: `PayRun with id '${payrunId}' not found`,
      });
    }

    if (payrun.status !== PayRunStatus.DRAFT && payrun.status !== PayRunStatus.SNAPSHOT) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `PayRun must be in DRAFT or SNAPSHOT status to snapshot. Current: ${payrun.status}`,
      });
    }

    const effectiveDate = new Date(snapshotEffectiveAt);

    if (isNaN(effectiveDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_DATE',
        message: `Invalid snapshot effective date: ${snapshotEffectiveAt}`,
        details: { providedDate: snapshotEffectiveAt },
      });
    }

    const country = payrun.payGroup.country as Country;
    const currency = payrun.payGroup.currency as Currency;

    // Resolve statutory configuration via PackRouterService
    let routing;
    try {
      routing = await this.packRouter.resolveRouting({
        country: country as 'LS' | 'ZA',
        legal_entity_id: payrun.payGroup.legalEntityId,
        pay_date: snapshotEffectiveAt,
        period_end: payrun.periodEnd ? payrun.periodEnd.toISOString().slice(0, 10) : snapshotEffectiveAt,
        run_type: 'REGULAR',
      });
    } catch (error) {
      this.logger.error(`Pack routing failed for ${country} on ${snapshotEffectiveAt}: ${error.message}`);
      throw new BadRequestException({
        code: 'STATUTORY_CONFIG_RESOLUTION_FAILED',
        message: `Failed to resolve statutory configuration for ${country} on ${snapshotEffectiveAt}: ${error.message}`,
        details: { country, effectiveDate: snapshotEffectiveAt },
      });
    }

    const taxTable = {
      effective_from: routing.tax_tables.data.brackets ? snapshotEffectiveAt : null,
      table_set_id: routing.tax_tables.paye_table_set_id,
      checksum: routing.tax_tables.checksum,
      brackets: routing.tax_tables.data.brackets,
      meta: {
        ...(routing.tax_tables.data.credits || {}),
        ...(routing.tax_tables.data.rebates ? { rebates: routing.tax_tables.data.rebates } : {}),
        ...(routing.tax_tables.data.thresholds ? { thresholds: routing.tax_tables.data.thresholds } : {}),
        periods_per_year: routing.tax_tables.data.periods_per_year,
        ...(routing.statutory_configs?.uif_data ? { uif: routing.statutory_configs.uif_data } : {}),
        ...(routing.statutory_configs?.sdl_data ? { sdl: routing.statutory_configs.sdl_data } : {}),
        ...(routing.statutory_configs?.mtc_data ? { mtc: routing.statutory_configs.mtc_data } : {}),
      },
    };
    const packVersion = routing.pack.version;

    // Get eligible employees
    const preview = await this.previewInclusions(payrunId, undefined, user);
    let employeesToInclude = preview.candidates.map((c) => c.employee_id);

    // Apply include/exclude filters
    if (includeEmployeeIds && includeEmployeeIds.length > 0) {
      employeesToInclude = employeesToInclude.filter((id) => includeEmployeeIds.includes(id));
    }

    if (excludeEmployeeIds && excludeEmployeeIds.length > 0) {
      employeesToInclude = employeesToInclude.filter((id) => !excludeEmployeeIds.includes(id));
    }

    if (employeesToInclude.length === 0) {
      const cappedCandidates = this.capPreviewRows(preview.candidates);
      const cappedExcluded = this.capPreviewRows(preview.excluded);

      if (preview.candidates.length > 0) {
        throw new BadRequestException({
          code: 'NO_EMPLOYEES_AFTER_SNAPSHOT_FILTERS',
          message:
            'Snapshot include/exclude lists removed every candidate. Widen include_employee_ids or clear exclude_employee_ids, then retry.',
          details: {
            payrunId,
            payGroupId: payrun.payGroupId,
            pay_group: {
              id: payrun.payGroupId,
              code: payrun.payGroup.code,
              name: payrun.payGroup.name,
            },
            candidate_count_before_filters: preview.candidates.length,
            include_employee_ids: includeEmployeeIds ?? [],
            exclude_employee_ids: excludeEmployeeIds ?? [],
            preview_candidates: cappedCandidates.items,
            preview_candidates_truncated: cappedCandidates.truncated,
          },
        });
      }

      const employmentScope =
        preview.candidates.length === 0 &&
        preview.excluded.length === 0 &&
        payrun.periodStart &&
        payrun.periodEnd
          ? await this.getEmploymentScopeCounts(payrun.payGroupId, payrun.periodStart, payrun.periodEnd)
          : null;

      const periodLabel =
        payrun.periodStart && payrun.periodEnd
          ? `${payrun.periodStart.toISOString().slice(0, 10)} … ${payrun.periodEnd.toISOString().slice(0, 10)}`
          : 'period dates unknown';

      throw new BadRequestException({
        code: 'NO_ELIGIBLE_EMPLOYEES_FOR_SNAPSHOT',
        message: this.buildNoEligibleEmployeesMessage(preview, employmentScope, periodLabel),
        details: {
          payrunId,
          payGroupId: payrun.payGroupId,
          pay_group: {
            id: payrun.payGroupId,
            code: payrun.payGroup.code,
            name: payrun.payGroup.name,
          },
          period:
            payrun.periodStart && payrun.periodEnd
              ? {
                  period_start: payrun.periodStart.toISOString(),
                  period_end: payrun.periodEnd.toISOString(),
                  pay_date: payrun.payDate?.toISOString() ?? null,
                  snapshot_effective_at: snapshotEffectiveAt,
                }
              : null,
          preview_candidates_count: preview.candidates.length,
          preview_excluded_count: preview.excluded.length,
          exclusion_summary: this.summarizeExclusionReasons(preview.excluded),
          preview_candidates: cappedCandidates.items,
          preview_excluded: cappedExcluded.items,
          preview_candidates_truncated: cappedCandidates.truncated,
          preview_excluded_truncated: cappedExcluded.truncated,
          employment_scope: employmentScope,
        },
      });
    }

    // Create snapshot in a transaction
    try {
      const snapshotErrors: Array<{ employeeId: string; error: string }> = [];

      await this.prisma.$transaction(async (tx) => {
        // Remove existing employee entries
        await tx.payRunEmployee.deleteMany({
          where: { payrunId },
        });

        // Create payrun context with full statutory routing
        await tx.payRunContext.upsert({
          where: { payrunId },
          create: {
            payrunId,
            country,
            currency,
            legalEntityId: payrun.payGroup.legalEntityId,
            packVersion: packVersion,
            packRegistryId: routing.pack.id,
            taxTableSetId: routing.tax_tables.paye_table_set_id,
            taxTable,
            roundingPolicy: { mode: 'HALF_UP', decimals: 2 },
            computeDateRule: routing.compute_date_rule,
            computeDateValue: routing.compute_date_value,
            checksums: routing.checksums,
          },
          update: {
            packVersion: packVersion,
            packRegistryId: routing.pack.id,
            taxTableSetId: routing.tax_tables.paye_table_set_id,
            taxTable,
            computeDateRule: routing.compute_date_rule,
            computeDateValue: routing.compute_date_value,
            checksums: routing.checksums,
          },
        });

        // Snapshot each employee
        for (const employeeId of employeesToInclude) {
          try {
            const snapshotData = await this.effectiveDatedService.snapshotEmployeeData(
              employeeId,
              effectiveDate,
            );

            // Validate snapshot data
            if (!snapshotData.employment || !snapshotData.compensation) {
              throw new Error(
                `Missing critical data: employment=${!!snapshotData.employment}, compensation=${!!snapshotData.compensation}`,
              );
            }

            await tx.payRunEmployee.create({
              data: {
                payrunId,
                employeeId,
                included: true,
                snapshotData,
              },
            });
          } catch (error) {
            snapshotErrors.push({
              employeeId,
              error: `Failed to snapshot employee: ${error.message}`,
            });
          }
        }

        if (snapshotErrors.length > 0) {
          throw new Error(
            `Failed to snapshot ${snapshotErrors.length} employees: ${snapshotErrors
              .map((e) => e.employeeId)
              .join(', ')}`,
          );
        }

        // Update payrun status
        await tx.payRun.update({
          where: { id: payrunId },
          data: {
            status: PayRunStatus.SNAPSHOT,
            snapshotAt: new Date(),
          },
        });
      });
    } catch (error) {
      throw new BadRequestException({
        code: 'SNAPSHOT_FAILED',
        message: `Failed to create payrun snapshot: ${error.message}`,
        details: {
          payrunId,
          employeeCount: employeesToInclude.length,
        },
      });
    }

    await this.auditService.log({
      userId: user?.sub,
      action: 'SNAPSHOT',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: {
        included_count: employeesToInclude.length,
        effective_at: snapshotEffectiveAt,
      },
      reason,
    });

    return {
      payrun_id: payrunId,
      status: PayRunStatus.SNAPSHOT,
      included_count: employeesToInclude.length,
    };
  }

  async includeExcludeEmployee(
    payrunId: string,
    employeeId: string,
    action: 'INCLUDE' | 'EXCLUDE',
    note?: string,
    user?: RequestUser,
    reason?: string,
  ) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    const allowedStates = [PayRunStatus.DRAFT, PayRunStatus.SNAPSHOT, PayRunStatus.CALCULATED];
    if (!allowedStates.includes(payrun.status as PayRunStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Cannot modify employees in ${payrun.status} status`,
      });
    }

    await this.prisma.payRunEmployee.upsert({
      where: {
        payrunId_employeeId: { payrunId, employeeId },
      },
      create: {
        payrunId,
        employeeId,
        included: action === 'INCLUDE',
        excludeNote: action === 'EXCLUDE' ? note : null,
      },
      update: {
        included: action === 'INCLUDE',
        excludeNote: action === 'EXCLUDE' ? note : null,
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: `${action}_EMPLOYEE`,
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { employee_id: employeeId, action },
      reason,
    });

    return {
      payrun_id: payrunId,
      employee_id: employeeId,
      action,
      status: payrun.status,
    };
  }

  async removeEmployee(payrunId: string, employeeId: string, user?: RequestUser, reason?: string) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    const allowedStates = [PayRunStatus.DRAFT, PayRunStatus.SNAPSHOT];
    if (!allowedStates.includes(payrun.status as PayRunStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Cannot remove employees in ${payrun.status} status`,
      });
    }

    await this.prisma.payRunEmployee.deleteMany({
      where: { payrunId, employeeId },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'REMOVE_EMPLOYEE',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { employee_id: employeeId },
      reason,
    });
  }
}
