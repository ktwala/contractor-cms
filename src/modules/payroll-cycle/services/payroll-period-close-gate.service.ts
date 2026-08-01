import { Injectable } from '@nestjs/common';
import { PayRunStatus } from '@prisma/client';
import { PrismaService } from '../../../core/database/prisma.service';
import { PayrunReadinessGateService } from '../../payruns/payrun-readiness-gate.service';
import {
  PayrunFinancialControlService,
  type PayrunFinancialOverrideHeaders,
} from '../../payruns/payrun-financial-control.service';
import {
  PayrunBankReconciliationService,
  type PayrunBankOverrideHeaders,
} from '../../payruns/payrun-bank-reconciliation.service';
import {
  PayrunGLReconciliationService,
  type PayrunGLOverrideHeaders,
} from '../../payruns/payrun-gl-reconciliation.service';
import { PayrunPostCloseReconciliationImpactService } from '../../payruns/payrun-post-close-reconciliation-impact.service';

export type PeriodCloseGovernanceUser = { sub: string; permissions?: string[] };

/**
 * PR-PAYRUN-GOV-3C orchestration: period close must satisfy readiness + GOV-3A + GOV-3B + GOV-3C
 * for every payrun on the period in PAID / POSTED / FINALIZED.
 * GOV-4: post-reversal / correction reconciliation impact must be cleared before close.
 */
@Injectable()
export class PayrollPeriodCloseGateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly readinessGate: PayrunReadinessGateService,
    private readonly financialControl: PayrunFinancialControlService,
    private readonly bankReconciliation: PayrunBankReconciliationService,
    private readonly glReconciliation: PayrunGLReconciliationService,
    private readonly postCloseImpact: PayrunPostCloseReconciliationImpactService,
  ) {}

  async assertAllowsPeriodClose(
    periodId: string,
    user: PeriodCloseGovernanceUser,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<void> {
    const payruns = await this.prisma.payRun.findMany({
      where: {
        periodId,
        status: { in: [PayRunStatus.PAID, PayRunStatus.POSTED, PayRunStatus.FINALIZED] },
      },
      select: { id: true, payGroupId: true },
    });
    if (payruns.length === 0) {
      return;
    }

    const payGroupIds = [...new Set(payruns.map((p) => p.payGroupId))];
    for (const pgId of payGroupIds) {
      await this.readinessGate.assertPayGroupAllowed(
        pgId,
        user,
        this.readinessOverrideFrom(headers),
        'payroll.period_close',
      );
    }

    for (const pr of payruns) {
      await this.postCloseImpact.assertAllowsPeriodClose(pr.id);
      await this.financialControl.assertAllowsMarkPaidOrPosted(
        pr.id,
        user,
        this.financialOverrideFrom(headers),
        'payroll.period_close',
      );
      await this.bankReconciliation.assertAllowsMarkPostedBankGate(
        pr.id,
        user,
        this.bankOverrideFrom(headers),
        'payroll.period_close',
      );
      await this.glReconciliation.assertAllowsPeriodCloseGl(
        pr.id,
        user,
        this.glOverrideFrom(headers),
        'payroll.period_close',
      );
    }
  }

  private firstHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const v = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(v)) return v[0];
    return typeof v === 'string' ? v : undefined;
  }

  private readinessOverrideFrom(headers: Record<string, string | string[] | undefined>) {
    return {
      overrideHeader: this.firstHeader(headers, 'x-readiness-gate-override'),
      justification: this.firstHeader(headers, 'x-readiness-override-justification'),
    };
  }

  private financialOverrideFrom(headers: Record<string, string | string[] | undefined>): PayrunFinancialOverrideHeaders {
    return {
      overrideHeader: this.firstHeader(headers, 'x-financial-gate-override'),
      justification: this.firstHeader(headers, 'x-financial-override-justification'),
    };
  }

  private bankOverrideFrom(headers: Record<string, string | string[] | undefined>): PayrunBankOverrideHeaders {
    return {
      overrideHeader: this.firstHeader(headers, 'x-bank-gate-override'),
      justification: this.firstHeader(headers, 'x-bank-override-justification'),
    };
  }

  private glOverrideFrom(headers: Record<string, string | string[] | undefined>): PayrunGLOverrideHeaders {
    return {
      overrideHeader: this.firstHeader(headers, 'x-gl-gate-override'),
      justification: this.firstHeader(headers, 'x-gl-override-justification'),
    };
  }
}
