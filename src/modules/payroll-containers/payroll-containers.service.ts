import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrollTaxYearStatus } from '@prisma/client';
import { AuditService } from '../../core/audit/audit.service';
import { PrismaService } from '../../core/database/prisma.service';
import { CurrentUserData } from '../../common/decorators/current-user.decorator';
import {
  PAYRUN_ACTIVE_IN_FLIGHT_STATUSES,
  PAYRUN_PAYROLL_ACTIVITY_STATUSES,
  collectArchiveBlockers,
  collectCloseBlockers,
} from './payroll-container-lifecycle.policy';

@Injectable()
export class PayrollContainersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private assertLegalEntityScope(user: CurrentUserData) {
    const allowed = user.legalEntityAccess || [];
    if (!user.hasGlobalScope && allowed.length === 0) {
      throw new ForbiddenException({
        code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
        message: 'No legal entity access assigned to this user.',
      });
    }
    return allowed;
  }

  async findAll(user: CurrentUserData, payGroupId?: string) {
    const allowed = this.assertLegalEntityScope(user);

    const where: any = {};
    if (payGroupId) {
      where.payGroupId = payGroupId;
    }
    if (!user.hasGlobalScope) {
      where.payGroup = { legalEntityId: { in: allowed } };
    }

    const [rows, total] = await Promise.all([
      this.prisma.payroll.findMany({
        where,
        include: {
          payGroup: {
            select: {
              id: true,
              code: true,
              name: true,
              legalEntityId: true,
              country: true,
              frequency: true,
              legalEntity: { select: { id: true, code: true, name: true } },
            },
          },
        },
        orderBy: [{ taxYearStart: 'desc' }, { label: 'asc' }],
        take: 200,
      }),
      this.prisma.payroll.count({ where }),
    ]);

    return {
      items: rows.map((r) => this.mapRow(r)),
      total,
    };
  }

  async findOne(id: string, user: CurrentUserData) {
    const allowed = this.assertLegalEntityScope(user);

    const row = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        payGroup: {
          select: {
            id: true,
            code: true,
            name: true,
            legalEntityId: true,
            country: true,
            frequency: true,
            legalEntity: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'PAYROLL_CONTAINER_NOT_FOUND',
        message: `Payroll container '${id}' not found`,
      });
    }

    if (!user.hasGlobalScope && !allowed.includes(row.payGroup.legalEntityId)) {
      throw new ForbiddenException({
        code: 'PAYROLL_LEGAL_ENTITY_DENIED',
        message: 'No access to this payroll container',
      });
    }

    const [periodRows, periodsTotal] = await Promise.all([
      this.prisma.payPeriod.findMany({
        where: { payrollId: id },
        orderBy: [{ startDate: 'desc' }],
        take: 500,
        select: {
          id: true,
          startDate: true,
          endDate: true,
          payDate: true,
          year: true,
          periodNum: true,
          closedAt: true,
        },
      }),
      this.prisma.payPeriod.count({ where: { payrollId: id } }),
    ]);

    return {
      ...this.mapRow(row),
      periods_total: periodsTotal,
      periods: periodRows.map((p) => ({
        id: p.id,
        start_date: p.startDate.toISOString().slice(0, 10),
        end_date: p.endDate.toISOString().slice(0, 10),
        pay_date: p.payDate.toISOString().slice(0, 10),
        year: p.year,
        period_num: p.periodNum,
        closed_at: p.closedAt ? p.closedAt.toISOString() : null,
      })),
    };
  }

  /** PR-PAYROLL-CONTAINER-3 — orphan periods (null payroll_id) scoped like list/detail. */
  async getLinkageHealth(user: CurrentUserData) {
    const allowed = this.assertLegalEntityScope(user);

    const where: any = { payrollId: null };
    if (!user.hasGlobalScope) {
      where.payGroup = { legalEntityId: { in: allowed } };
    }

    const orphanPeriodCount = await this.prisma.payPeriod.count({ where });

    return {
      orphan_period_count: orphanPeriodCount,
    };
  }

  /** PR-PAYROLL-CONTAINER-4 — preview close/archive gates (no mutation). */
  async getLifecycleEligibility(id: string, user: CurrentUserData) {
    const row = await this.loadPayrollForMutation(id, user);
    const counts = await this.computeLifecycleCounts(id);

    const closeBlockers = collectCloseBlockers(counts.activePayrunCount);
    const archiveBlockers = collectArchiveBlockers(counts);

    const canClose =
      (row.status === PayrollTaxYearStatus.PLANNING || row.status === PayrollTaxYearStatus.ACTIVE) &&
      closeBlockers.length === 0;

    const canArchive =
      row.status !== PayrollTaxYearStatus.ARCHIVED && archiveBlockers.length === 0;

    return {
      status: row.status,
      can_close: canClose,
      can_archive: canArchive,
      close_blockers: closeBlockers,
      archive_blockers: archiveBlockers,
      counts: {
        linked_periods: counts.linkedPeriodCount,
        periods_closed: counts.periodsClosedCount,
        active_payruns: counts.activePayrunCount,
        activity_payruns: counts.activityPayrunCount,
      },
    };
  }

  /** PR-PAYROLL-CONTAINER-4 — administrative close (tax-year shell). */
  async close(id: string, user: CurrentUserData, body?: { reason?: string }) {
    const row = await this.loadPayrollForMutation(id, user);
    if (
      row.status !== PayrollTaxYearStatus.PLANNING &&
      row.status !== PayrollTaxYearStatus.ACTIVE
    ) {
      throw new ConflictException({
        code: 'PAYROLL_CONTAINER_CLOSE_INVALID_STATE',
        message: `Cannot close shell in status ${row.status}.`,
      });
    }

    const counts = await this.computeLifecycleCounts(id);
    const closeBlockers = collectCloseBlockers(counts.activePayrunCount);
    if (closeBlockers.length > 0) {
      throw new BadRequestException({
        code: 'PAYROLL_CLOSE_BLOCKED',
        message: 'Cannot close while payruns are still in-flight on linked periods.',
        blockers: closeBlockers,
      });
    }

    const reason = this.normalizeReason(body?.reason);

    await this.prisma.payroll.update({
      where: { id },
      data: { status: PayrollTaxYearStatus.CLOSED },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'PAYROLL_CONTAINER_CLOSED',
      entityType: 'Payroll',
      entityId: id,
      oldValue: { status: row.status },
      newValue: {
        status: PayrollTaxYearStatus.CLOSED,
        pay_group_id: row.payGroupId,
        legal_entity_id: row.payGroup.legalEntityId,
        reason,
      },
      reason: 'payroll_container_close',
    });

    return this.mapContainerRow(id);
  }

  /** PR-PAYROLL-CONTAINER-4 — archive shell only when unused/safe (no hard delete). */
  async archive(id: string, user: CurrentUserData, body?: { reason?: string }) {
    const row = await this.loadPayrollForMutation(id, user);
    if (row.status === PayrollTaxYearStatus.ARCHIVED) {
      throw new ConflictException({
        code: 'PAYROLL_CONTAINER_ALREADY_ARCHIVED',
        message: 'This payroll container is already archived.',
      });
    }

    const counts = await this.computeLifecycleCounts(id);
    const archiveBlockers = collectArchiveBlockers(counts);
    if (archiveBlockers.length > 0) {
      throw new BadRequestException({
        code: 'PAYROLL_ARCHIVE_BLOCKED',
        message: 'Cannot archive while governance gates fail.',
        blockers: archiveBlockers,
      });
    }

    const reason = this.normalizeReason(body?.reason);

    await this.prisma.payroll.update({
      where: { id },
      data: { status: PayrollTaxYearStatus.ARCHIVED },
    });

    await this.audit.log({
      userId: user.sub,
      action: 'PAYROLL_CONTAINER_ARCHIVED',
      entityType: 'Payroll',
      entityId: id,
      oldValue: { status: row.status },
      newValue: {
        status: PayrollTaxYearStatus.ARCHIVED,
        pay_group_id: row.payGroupId,
        legal_entity_id: row.payGroup.legalEntityId,
        reason,
      },
      reason: 'payroll_container_archive',
    });

    return this.mapContainerRow(id);
  }

  private async mapContainerRow(id: string) {
    const row = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        payGroup: {
          select: {
            id: true,
            code: true,
            name: true,
            legalEntityId: true,
            country: true,
            frequency: true,
            legalEntity: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'PAYROLL_CONTAINER_NOT_FOUND',
        message: `Payroll container '${id}' not found`,
      });
    }
    return this.mapRow(row);
  }

  private normalizeReason(reason?: string): string | undefined {
    if (reason == null || typeof reason !== 'string') return undefined;
    const t = reason.trim();
    if (!t) return undefined;
    return t.slice(0, 500);
  }

  private async loadPayrollForMutation(id: string, user: CurrentUserData) {
    const allowed = this.assertLegalEntityScope(user);

    const row = await this.prisma.payroll.findUnique({
      where: { id },
      include: {
        payGroup: { select: { legalEntityId: true } },
      },
    });

    if (!row) {
      throw new NotFoundException({
        code: 'PAYROLL_CONTAINER_NOT_FOUND',
        message: `Payroll container '${id}' not found`,
      });
    }

    if (!user.hasGlobalScope && !allowed.includes(row.payGroup.legalEntityId)) {
      throw new ForbiddenException({
        code: 'PAYROLL_LEGAL_ENTITY_DENIED',
        message: 'No access to this payroll container',
      });
    }

    return row;
  }

  private async computeLifecycleCounts(payrollId: string) {
    const linked = await this.prisma.payPeriod.findMany({
      where: { payrollId },
      select: { id: true },
    });
    const ids = linked.map((p) => p.id);

    if (ids.length === 0) {
      return {
        linkedPeriodCount: 0,
        periodsClosedCount: 0,
        activePayrunCount: 0,
        activityPayrunCount: 0,
      };
    }

    const [periodsClosedCount, activePayrunCount, activityPayrunCount] = await Promise.all([
      this.prisma.payPeriod.count({
        where: { payrollId, closedAt: { not: null } },
      }),
      this.prisma.payRun.count({
        where: {
          periodId: { in: ids },
          status: { in: [...PAYRUN_ACTIVE_IN_FLIGHT_STATUSES] },
        },
      }),
      this.prisma.payRun.count({
        where: {
          periodId: { in: ids },
          status: { in: [...PAYRUN_PAYROLL_ACTIVITY_STATUSES] },
        },
      }),
    ]);

    return {
      linkedPeriodCount: ids.length,
      periodsClosedCount,
      activePayrunCount,
      activityPayrunCount,
    };
  }

  private mapRow(r: {
    id: string;
    payGroupId: string;
    label: string;
    taxYearStart: Date;
    taxYearEnd: Date;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    payGroup: {
      id: string;
      code: string;
      name: string;
      legalEntityId: string;
      country: string;
      frequency: string;
      legalEntity: { id: string; code: string; name: string };
    };
  }) {
    return {
      id: r.id,
      pay_group_id: r.payGroupId,
      label: r.label,
      tax_year_start: r.taxYearStart.toISOString().slice(0, 10),
      tax_year_end: r.taxYearEnd.toISOString().slice(0, 10),
      status: r.status,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
      pay_group: {
        id: r.payGroup.id,
        code: r.payGroup.code,
        name: r.payGroup.name,
        legal_entity_id: r.payGroup.legalEntityId,
        country: r.payGroup.country,
        frequency: r.payGroup.frequency,
      },
      legal_entity: {
        id: r.payGroup.legalEntity.id,
        code: r.payGroup.legalEntity.code,
        name: r.payGroup.legalEntity.name,
      },
    };
  }
}
