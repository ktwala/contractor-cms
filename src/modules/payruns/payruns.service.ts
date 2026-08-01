import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  PayrunClosedPeriodMutationGuardService,
  type PayrunClosedPeriodMutationHeaders,
} from './payrun-closed-period-mutation-guard.service';
import { CreatePayRunDto } from './dto/create-payrun.dto';
import { ListPayRunsDto } from './dto/list-payruns.dto';
import { PayRunStatus, PayRunType, Country, Currency } from '../../common/dto/enums.dto';
import { format } from 'date-fns';

export type RequestUser = { sub: string; legalEntityAccess?: string[]; roles?: string[]; permissions?: string[] };

@Injectable()
export class PayrunsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly closedPeriodGuard: PayrunClosedPeriodMutationGuardService,
  ) {}

  private assertHasLegalEntityAccess(user: RequestUser) {
    const allowed = user.legalEntityAccess || [];
    if (allowed.length === 0) {
      throw new ForbiddenException({
        code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
        message: 'No legal entity access assigned to this user. Create a legal entity and assign it before managing payruns.',
      });
    }
    return allowed;
  }

  private assertEntityAllowed(user: RequestUser, legalEntityId: string) {
    const allowed = this.assertHasLegalEntityAccess(user);
    if (!allowed.includes(legalEntityId)) {
      throw new ForbiddenException({
        code: 'PAYROLL_LEGAL_ENTITY_DENIED',
        message: 'No access to this legal entity',
      });
    }
  }

  /**
   * Resolves pay period dates the same way as create(), without duplicate-payrun or closed-period checks.
   * Used for pre-create eligibility preview so the wizard matches snapshot inclusion logic.
   */
  async resolvePayrunPeriodForPreview(
    dto: Pick<CreatePayRunDto, 'pay_group_id' | 'period_id' | 'period_start' | 'period_end' | 'pay_date'>,
    user: RequestUser,
  ) {
    const payGroup = await this.prisma.payGroup.findUnique({
      where: { id: dto.pay_group_id },
      include: { legalEntity: true },
    });

    if (!payGroup) {
      throw new NotFoundException({
        code: 'PAY_GROUP_NOT_FOUND',
        message: `Pay group with id '${dto.pay_group_id}' not found`,
      });
    }

    this.assertEntityAllowed(user, payGroup.legalEntityId);

    let periodId = dto.period_id || null;
    let periodStart = dto.period_start ? new Date(dto.period_start) : null;
    let periodEnd = dto.period_end ? new Date(dto.period_end) : null;
    let payDate = dto.pay_date ? new Date(dto.pay_date) : null;

    if (periodId) {
      const period = await this.prisma.payPeriod.findUnique({
        where: { id: periodId },
      });

      if (!period) {
        throw new NotFoundException({
          code: 'PAY_PERIOD_NOT_FOUND',
          message: `Pay period with id '${periodId}' not found`,
        });
      }

      if (period.payGroupId !== dto.pay_group_id) {
        throw new BadRequestException({
          code: 'PERIOD_PAY_GROUP_MISMATCH',
          message: 'Pay period does not belong to the specified pay group',
        });
      }

      periodStart = period.startDate;
      periodEnd = period.endDate;
      payDate = period.payDate;
    }

    if (!periodStart || !periodEnd || !payDate) {
      throw new BadRequestException({
        code: 'PERIOD_DATES_REQUIRED',
        message: 'Either period_id or (period_start, period_end, pay_date) must be provided',
      });
    }

    return { payGroup, periodId, periodStart, periodEnd, payDate };
  }

  async create(
    dto: CreatePayRunDto,
    user: RequestUser,
    reason?: string,
    closedPeriodHeaders: PayrunClosedPeriodMutationHeaders = {},
  ) {
    const { payGroup, periodId, periodStart, periodEnd, payDate } = await this.resolvePayrunPeriodForPreview(
      dto,
      user,
    );

    if (periodId) {
      const existing = await this.prisma.payRun.findFirst({
        where: {
          payGroupId: dto.pay_group_id,
          periodId,
          payrunType: PayRunType.REGULAR,
          status: { notIn: ['CANCELLED'] },
        },
      });
      if (existing) {
        throw new ConflictException({
          code: 'DUPLICATE_PAYRUN',
          message: 'A payrun already exists for this pay group and period.',
        });
      }
    }

    await this.closedPeriodGuard.assertAllowsCreateRegularForPeriod(
      periodId,
      { sub: user.sub, permissions: user.permissions },
      closedPeriodHeaders,
      'payrun.create',
    );

    let payrun;
    try {
      payrun = await this.prisma.payRun.create({
        data: {
          payGroupId: dto.pay_group_id,
          periodId,
          periodStart,
          periodEnd,
          payDate,
          status: PayRunStatus.DRAFT,
          payrunType: PayRunType.REGULAR,
          notes: dto.notes,
          createdByUserId: user.sub,
        },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException({
          code: 'DUPLICATE_PAYRUN',
          message: 'A payrun already exists for this pay group and period.',
        });
      }
      throw e;
    }

    await this.auditService.log({
      userId: user.sub,
      action: 'CREATE',
      entityType: 'PayRun',
      entityId: payrun.id,
      newValue: payrun as any,
      reason,
    });

    return this.mapToResponse(payrun, payGroup);
  }

  async findAll(query: ListPayRunsDto, user: RequestUser) {
    const where: any = {};
    const allowed = this.assertHasLegalEntityAccess(user);

    if (query.pay_group_id) {
      where.payGroupId = query.pay_group_id;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.from || query.to) {
      where.periodStart = {};
      if (query.from) {
        where.periodStart.gte = new Date(query.from);
      }
      if (query.to) {
        where.periodEnd = { lte: new Date(query.to) };
      }
    }

    // Filter by country or legal_entity through pay group
    if (query.country || query.legal_entity_id) {
      where.payGroup = where.payGroup || {};
      if (query.country) {
        where.payGroup.country = query.country;
      }
      if (query.legal_entity_id) {
        if (!allowed.includes(query.legal_entity_id)) {
          throw new ForbiddenException({
            code: 'PAYROLL_LEGAL_ENTITY_DENIED',
            message: 'No access to requested legal entity',
          });
        }
        where.payGroup.legalEntityId = query.legal_entity_id;
      }
    }

    // Always enforce legal entity scope (even if no filter requested)
    where.payGroup = where.payGroup || {};
    where.payGroup.legalEntityId = where.payGroup.legalEntityId || { in: allowed };

    const [items, total] = await Promise.all([
      this.prisma.payRun.findMany({
        where,
        include: {
          payGroup: {
            include: { legalEntity: true },
          },
        },
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payRun.count({ where }),
    ]);

    return {
      items: items.map((pr) => this.mapToResponse(pr, pr.payGroup)),
      total,
      offset: query.offset || 0,
      limit: query.limit || 50,
    };
  }

  async findOne(id: string, user: RequestUser) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id },
      include: {
        payGroup: {
          include: { legalEntity: true },
        },
      },
    });

    if (!payrun) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `PayRun with id '${id}' not found`,
      });
    }

    // Enforce legal entity scope
    this.assertEntityAllowed(user, payrun.payGroup.legalEntityId);

    return this.mapToResponse(payrun, payrun.payGroup);
  }

  async getContext(id: string, user: RequestUser) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id },
      include: {
        payGroup: {
          include: { legalEntity: true },
        },
        context: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `PayRun with id '${id}' not found`,
      });
    }

    // Enforce legal entity scope
    this.assertEntityAllowed(user, payrun.payGroup.legalEntityId);

    if (!payrun.context) {
    return {
      payrun_id: payrun.id,
      pay_group_id: payrun.payGroupId,
      country: payrun.payGroup.country as any,
      currency: payrun.payGroup.currency as any,
      legal_entity_id: payrun.payGroup.legalEntityId,
      pack_version: null,
      tax_table: null,
      rounding_policy: null,
      created_at: null,
    } as any;
    }

    return {
      payrun_id: payrun.id,
      pay_group_id: payrun.payGroupId,
      country: payrun.context.country as any,
      currency: payrun.context.currency as any,
      legal_entity_id: payrun.context.legalEntityId,
      pack_version: payrun.context.packVersion,
      tax_table: payrun.context.taxTable as any,
      rounding_policy: payrun.context.roundingPolicy as any,
      created_at: payrun.context.createdAt.toISOString(),
    } as any;
  }

  async getLockRules(id: string, user: RequestUser) {
    const payrun = await this.findOne(id, user);
    const periodClosed =
      (payrun as any).payrun_type !== PayRunType.ADJUSTMENT &&
      !!(payrun as any).period_id &&
      (await this.prisma.payPeriod.findUnique({
        where: { id: (payrun as any).period_id as string },
        select: { closedAt: true },
      }))?.closedAt;

    const rules: Record<string, boolean> = {
      can_add_employees: false,
      can_remove_employees: false,
      can_add_inputs: false,
      can_calculate: false,
      can_submit: false,
      can_approve: false,
      can_revert: false,
      can_mark_paid: false,
      can_mark_posted: false,
      can_finalize: false,
      can_create_adjustment: false,
    };

    switch (payrun.status) {
      case PayRunStatus.DRAFT:
        rules.can_add_employees = true;
        rules.can_remove_employees = true;
        rules.can_add_inputs = true;
        break;
      case PayRunStatus.SNAPSHOT:
        rules.can_add_employees = true;
        rules.can_remove_employees = true;
        rules.can_add_inputs = true;
        rules.can_calculate = true;
        rules.can_revert = true;
        break;
      case PayRunStatus.CALCULATED:
        rules.can_add_inputs = true;
        rules.can_calculate = true;
        rules.can_submit = true;
        rules.can_revert = true;
        break;
      case PayRunStatus.IN_REVIEW:
        rules.can_approve = true;
        rules.can_revert = true;
        break;
      case PayRunStatus.APPROVED:
        rules.can_mark_paid = true;
        rules.can_mark_posted = true;
        break;
      case PayRunStatus.PAID:
        rules.can_mark_posted = true;
        rules.can_finalize = true;
        break;
      case PayRunStatus.POSTED:
        rules.can_mark_paid = true;
        rules.can_finalize = true;
        break;
      case PayRunStatus.FINALIZED:
        rules.can_create_adjustment = true;
        break;
    }

    if (periodClosed) {
      for (const k of Object.keys(rules) as (keyof typeof rules)[]) {
        rules[k] = k === 'can_create_adjustment' ? rules[k] : false;
      }
    }

    return {
      payrun_id: id,
      status: payrun.status as any,
      rules,
      period_closed: !!periodClosed,
    } as any;
  }

  async getSummary(id: string, user: RequestUser) {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id },
      include: {
        payGroup: { select: { legalEntityId: true } },
        employeeResults: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `PayRun with id '${id}' not found`,
      });
    }

    // Enforce legal entity scope
    this.assertEntityAllowed(user, payrun.payGroup.legalEntityId);

    const results = payrun.employeeResults;

    const registerEmployeeCount = await this.prisma.payRunEmployee.count({
      where: { payrunId: id, included: true },
    });

    const totals = results.reduce(
      (acc, r) => ({
        gross: acc.gross + Number(r.gross),
        taxable_income: acc.taxable_income + Number(r.taxableIncome),
        paye: acc.paye + Number(r.paye),
        deductions: acc.deductions + Number(r.deductionsTotal),
        net: acc.net + Number(r.net),
      }),
      { gross: 0, taxable_income: 0, paye: 0, deductions: 0, net: 0 },
    );

    // v1.1: Add exception summary and readiness flags
    const openExceptions = await this.prisma.payrunException.findMany({
      where: { payrunId: id, status: { in: ['OPEN', 'ASSIGNED'] } },
      select: { severity: true, blocksSubmission: true, blocksPayment: true },
    });

    const exceptions = {
      openTotal: openExceptions.length,
      criticalOpen: openExceptions.filter(e => e.severity === 'CRITICAL').length,
      highOpen: openExceptions.filter(e => e.severity === 'HIGH').length,
      mediumOpen: openExceptions.filter(e => e.severity === 'MEDIUM').length,
      lowOpen: openExceptions.filter(e => e.severity === 'LOW').length,
      blockingSubmissionCount: openExceptions.filter(e => e.blocksSubmission).length,
      blockingPaymentCount: openExceptions.filter(e => e.blocksPayment).length,
    };

    const readiness = {
      approvalReady: payrun.status === 'CALCULATED' && exceptions.blockingSubmissionCount === 0 && results.length > 0,
      paymentReady: (payrun.status === 'APPROVED' || payrun.status === 'POSTED') && exceptions.blockingPaymentCount === 0,
      hasSubmissionBlockers: exceptions.blockingSubmissionCount > 0,
      hasPaymentBlockers: exceptions.blockingPaymentCount > 0,
    };

    return {
      payrun_id: id,
      /** Rows in `employee_results` (post-calculate). */
      employee_count: results.length,
      /** Included rows in `payrun_employees` (register / snapshot). */
      register_employee_count: registerEmployeeCount,
      totals,
      exceptions,
      readiness,
    };
  }

  private mapToResponse(payrun: any, payGroup: any) {
    return {
      id: payrun.id,
      pay_group_id: payrun.payGroupId,
      period_id: payrun.periodId,
      period_start: payrun.periodStart ? format(payrun.periodStart, 'yyyy-MM-dd') : null,
      period_end: payrun.periodEnd ? format(payrun.periodEnd, 'yyyy-MM-dd') : null,
      pay_date: payrun.payDate ? format(payrun.payDate, 'yyyy-MM-dd') : null,
      status: payrun.status as PayRunStatus,
      payrun_type: payrun.payrunType as PayRunType,
      base_payrun_id: payrun.basePayrunId,
      adjustment_reason: payrun.adjustmentReason,
      adjustment_mode: payrun.adjustmentMode,
      notes: payrun.notes,
      approved_by: payrun.approvedByUserId,
      approved_at: payrun.approvedAt?.toISOString() || null,
      created_by_user_id: payrun.createdByUserId,
      submitted_by_user_id: payrun.submittedByUserId,
      paid_by_user_id: payrun.paidByUserId,
      posted_by_user_id: payrun.postedByUserId,
      finalized_by_user_id: payrun.finalizedByUserId,
      locked_at: payrun.lockedAt?.toISOString() || null,
      last_calculated_at: payrun.lastCalculatedAt?.toISOString() || null,
      created_at: payrun.createdAt.toISOString(),
      updated_at: payrun.updatedAt?.toISOString() || payrun.createdAt.toISOString(),
    };
  }
}
