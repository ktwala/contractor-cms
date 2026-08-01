import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PayrunBankReconciliationStatus,
  PayrunFinancialControlStatus,
  PayrunGLReconciliationStatus,
  PayrunExceptionStatus,
} from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import type { GovernancePortfolioSummaryDto, GovernancePortfolioScope } from '../dto/governance-portfolio-summary.dto';

export type PortfolioGateUser = {
  sub: string;
  permissions?: string[];
  legalEntityAccess?: string[];
  hasGlobalScope?: boolean;
};

const MAX_PAYRUNS = 2500;

@Injectable()
export class PayrollGovernancePortfolioService {
  constructor(private readonly prisma: PrismaService) {}

  async summarizePeriod(periodId: string, user: PortfolioGateUser): Promise<GovernancePortfolioSummaryDto> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: { payGroup: { include: { legalEntity: true } } },
    });
    if (!period) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pay period not found' });
    }
    this.assertLegalEntity(user, period.payGroup.legalEntityId);

    const payruns = await this.prisma.payRun.findMany({
      where: { periodId },
      select: { id: true },
      take: MAX_PAYRUNS,
    });
    const label = `${period.payGroup.code} · ${period.year}-${period.periodNum} (${period.startDate.toISOString().slice(0, 10)})`;
    return this.aggregate(payruns.map((p) => p.id), 'period', periodId, label);
  }

  async summarizePayGroup(payGroupId: string, user: PortfolioGateUser): Promise<GovernancePortfolioSummaryDto> {
    const pg = await this.prisma.payGroup.findUnique({
      where: { id: payGroupId },
      include: { legalEntity: true },
    });
    if (!pg) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Pay group not found' });
    }
    this.assertLegalEntity(user, pg.legalEntityId);

    const payruns = await this.prisma.payRun.findMany({
      where: { payGroupId },
      select: { id: true },
      take: MAX_PAYRUNS,
      orderBy: { createdAt: 'desc' },
    });
    return this.aggregate(payruns.map((p) => p.id), 'pay_group', payGroupId, `${pg.code} — ${pg.name}`);
  }

  async summarizeLegalEntity(legalEntityId: string, user: PortfolioGateUser): Promise<GovernancePortfolioSummaryDto> {
    const le = await this.prisma.legalEntity.findUnique({ where: { id: legalEntityId } });
    if (!le) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Legal entity not found' });
    }
    this.assertLegalEntity(user, legalEntityId);

    const payruns = await this.prisma.payRun.findMany({
      where: { payGroup: { legalEntityId } },
      select: { id: true },
      take: MAX_PAYRUNS,
      orderBy: { createdAt: 'desc' },
    });
    return this.aggregate(payruns.map((p) => p.id), 'legal_entity', legalEntityId, `${le.code} — ${le.name}`);
  }

  private assertLegalEntity(user: PortfolioGateUser, legalEntityId: string): void {
    if (user.hasGlobalScope) return;
    const allowed = user.legalEntityAccess ?? [];
    if (!allowed.includes(legalEntityId)) {
      throw new ForbiddenException({
        code: 'PAYROLL_GOVERNANCE_PORTFOLIO_DENIED',
        message: 'No access to this legal entity for governance portfolio.',
      });
    }
  }

  private async aggregate(
    payrunIds: string[],
    scope: GovernancePortfolioScope,
    scopeId: string,
    label: string | null,
  ): Promise<GovernancePortfolioSummaryDto> {
    const total_payruns = payrunIds.length;
    if (total_payruns === 0) {
      return {
        scope,
        scope_id: scopeId,
        label,
        total_payruns: 0,
        blocked_payruns_count: 0,
        stale_post_close_impact_count: 0,
        override_event_count: 0,
        financial_exception_payruns: 0,
        bank_exception_payruns: 0,
        gl_exception_payruns: 0,
        open_payrun_exceptions_count: 0,
      };
    }

    const inScope = { in: payrunIds };

    const [
      staleRows,
      fcBlocked,
      bankBlocked,
      glBlocked,
      fcExceptionRows,
      bankExceptionRows,
      glExceptionRows,
      openExc,
      overrideEvents,
    ] = await Promise.all([
      this.prisma.payRun.count({
        where: {
          id: inScope,
          OR: [
            { financialControlImpacted: true },
            { bankReconciliationImpacted: true },
            { glReconciliationImpacted: true },
          ],
        },
      }),
      this.prisma.payrunFinancialControl.findMany({
        where: { payrunId: inScope, status: PayrunFinancialControlStatus.BLOCKED },
        select: { payrunId: true },
      }),
      this.prisma.payrunBankReconciliation.findMany({
        where: { payrunId: inScope, status: PayrunBankReconciliationStatus.BLOCKED },
        select: { payrunId: true },
      }),
      this.prisma.payrunGLReconciliation.findMany({
        where: { payrunId: inScope, status: PayrunGLReconciliationStatus.BLOCKED },
        select: { payrunId: true },
      }),
      this.prisma.payrunFinancialControl.findMany({
        where: {
          payrunId: inScope,
          OR: [
            { status: PayrunFinancialControlStatus.BLOCKED },
            {
              status: PayrunFinancialControlStatus.VARIANCE,
              reviewRequired: true,
              reviewedAt: null,
            },
          ],
        },
        select: { payrunId: true },
      }),
      this.prisma.payrunBankReconciliation.findMany({
        where: {
          payrunId: inScope,
          OR: [
            { status: PayrunBankReconciliationStatus.BLOCKED },
            {
              status: PayrunBankReconciliationStatus.VARIANCE,
              reviewRequired: true,
              reviewedAt: null,
            },
            {
              status: { in: [PayrunBankReconciliationStatus.REJECTED, PayrunBankReconciliationStatus.PARTIAL] },
              reviewRequired: true,
              reviewedAt: null,
            },
          ],
        },
        select: { payrunId: true },
      }),
      this.prisma.payrunGLReconciliation.findMany({
        where: {
          payrunId: inScope,
          OR: [
            { status: PayrunGLReconciliationStatus.BLOCKED },
            {
              status: PayrunGLReconciliationStatus.VARIANCE,
              reviewRequired: true,
              reviewedAt: null,
            },
          ],
        },
        select: { payrunId: true },
      }),
      this.prisma.payrunException.count({
        where: {
          payrunId: inScope,
          status: { in: [PayrunExceptionStatus.OPEN, PayrunExceptionStatus.ASSIGNED] },
        },
      }),
      this.prisma.auditLog.count({
        where: {
          entityType: 'PayRun',
          entityId: inScope,
          OR: [
            { action: { contains: 'OVERRIDE', mode: 'insensitive' } },
            { action: { contains: 'BYPASS', mode: 'insensitive' } },
          ],
        },
      }),
    ]);

    const blockedSet = new Set<string>();
    for (const r of fcBlocked) blockedSet.add(r.payrunId);
    for (const r of bankBlocked) blockedSet.add(r.payrunId);
    for (const r of glBlocked) blockedSet.add(r.payrunId);

    return {
      scope,
      scope_id: scopeId,
      label,
      total_payruns,
      blocked_payruns_count: blockedSet.size,
      stale_post_close_impact_count: staleRows,
      override_event_count: overrideEvents,
      financial_exception_payruns: new Set(fcExceptionRows.map((r) => r.payrunId)).size,
      bank_exception_payruns: new Set(bankExceptionRows.map((r) => r.payrunId)).size,
      gl_exception_payruns: new Set(glExceptionRows.map((r) => r.payrunId)).size,
      open_payrun_exceptions_count: openExc,
    };
  }
}
