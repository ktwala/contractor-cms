import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PayrunBankConfirmationSourceType,
  PayrunBankReconciliationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from './payrun-governance-policy-resolution.service';
import {
  GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../payroll-cycle/constants/governance-policy-keys';
import type { BankConfirmationImportDto } from './dto/bank-confirmation-import.dto';

export const PAYRUN_BANK_OVERRIDE_PERMISSION = 'payrun:bank_override';
export const PAYRUN_BANK_OVERRIDE_JUSTIFICATION_MIN = 20;

/** Absolute total tolerance vs export (same currency) — baseline v1, aligned with GOV-3A. */
export const DEFAULT_BANK_TOTAL_TOLERANCE = 0.05;

export type PayrunBankOverrideHeaders = {
  overrideHeader?: string;
  justification?: string;
};

export type PayrunBankGateUser = {
  sub: string;
  permissions?: string[];
};

export type PayrunBankReconciliationResponse = {
  payrun_id: string;
  payment_batch_id: string;
  bank_file_reference: string;
  bank_file_hash: string | null;
  export_total: number;
  bank_confirmed_total: number;
  export_employee_count: number;
  bank_confirmed_employee_count: number;
  rejected_count: number;
  partial_count: number;
  variance_amount: number;
  status: PayrunBankReconciliationStatus;
  source_type: PayrunBankConfirmationSourceType;
  confirmed_at: string | null;
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  soft_warnings: string[];
  blocked_reasons: string[];
  imported_at: string;
  /** GOV-4 — see financial control / post-close acknowledge on source payrun. */
  post_close_reconciliation_impact_pending: boolean;
};

@Injectable()
export class PayrunBankReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly govPolicy: PayrunGovernancePolicyResolutionService,
  ) {}

  async getForPayrun(payrunId: string): Promise<PayrunBankReconciliationResponse | null> {
    const row = await this.getControllingReconRow(payrunId);
    if (!row) return null;
    const pr = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { bankReconciliationImpacted: true },
    });
    return this.mapRow(row, pr?.bankReconciliationImpacted === true);
  }

  /**
   * GOV-3B — blocks mark-posted unless export↔bank control is clear or treasury override is audited.
   */
  async assertAllowsMarkPostedBankGate(
    payrunId: string,
    user: PayrunBankGateUser,
    headers: PayrunBankOverrideHeaders,
    operation: 'payrun.mark_posted' | 'payroll.period_close',
  ): Promise<void> {
    const batchId = await this.resolveControllingBatchId(payrunId);
    if (!batchId) {
      throw new ForbiddenException({
        code: 'PAYRUN_BANK_GATE_BLOCKED',
        message:
          'No exported payment batch found for this payrun. Export payments and complete GOV-3A before marking posted.',
        bank_reconciliation_required: true,
      });
    }

    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id: batchId },
      select: { exportStatus: true },
    });
    if (batch?.exportStatus !== 'GENERATED') {
      throw new ForbiddenException({
        code: 'PAYRUN_BANK_GATE_BLOCKED',
        message: 'Payment export is not in GENERATED state; bank confirmation applies to a completed export.',
        bank_reconciliation_required: true,
      });
    }

    const recon = await this.prisma.payrunBankReconciliation.findUnique({
      where: { paymentBatchId: batchId },
    });
    if (!recon) {
      throw new ForbiddenException({
        code: 'PAYRUN_BANK_GATE_BLOCKED',
        message: 'Import bank confirmation for this payment batch before marking posted (GOV-3B).',
        bank_reconciliation_required: true,
      });
    }

    const ok =
      recon.status === PayrunBankReconciliationStatus.MATCH ||
      (recon.status === PayrunBankReconciliationStatus.VARIANCE &&
        (recon.reviewedAt != null || !recon.reviewRequired)) ||
      (recon.status === PayrunBankReconciliationStatus.REJECTED && recon.reviewedAt != null) ||
      (recon.status === PayrunBankReconciliationStatus.PARTIAL && recon.reviewedAt != null);

    if (ok) {
      return;
    }

    const hasPerm = user.permissions?.includes(PAYRUN_BANK_OVERRIDE_PERMISSION) === true;
    const approved = (headers.overrideHeader || '').trim().toLowerCase() === 'approved';
    const justification = (headers.justification || '').trim();
    const ctx = await this.govPolicy.resolvePayrunContext(payrunId);
    const jPol = ctx
      ? await this.govPolicy.resolveJustificationMinForContext(ctx, PAYRUN_BANK_OVERRIDE_JUSTIFICATION_MIN)
      : {
          value: PAYRUN_BANK_OVERRIDE_JUSTIFICATION_MIN,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
        };
    const justificationOk = justification.length >= jPol.value;

    if (hasPerm && approved && justificationOk) {
      await this.audit.log({
        userId: user.sub,
        action: 'PAYRUN_BANK_RECON_OVERRIDE',
        entityType: 'PayRun',
        entityId: payrunId,
        newValue: {
          operation,
          status: recon.status,
          payment_batch_id: batchId,
          justification,
          blocked_reasons: recon.blockedReasonsJson,
          soft_warnings: recon.softWarningsJson,
          governance_policy_key: jPol.policy_key,
          governance_policy_id: jPol.policy_id,
          governance_policy_source: jPol.source,
          justification_min_length_applied: jPol.value,
        },
        reason: `bank_gate_override:${operation}`,
      });
      return;
    }

    throw new ForbiddenException({
      code: 'PAYRUN_BANK_GATE_BLOCKED',
      message:
        'Bank confirmation is not cleared for mark posted. Resolve blockers, complete settlement review, or use an audited bank gate override.',
      status: recon.status,
      blocked_reasons: recon.blockedReasonsJson,
      soft_warnings: recon.softWarningsJson,
      review_required: recon.reviewRequired,
    });
  }

  async importBankConfirmation(
    payrunId: string,
    userId: string,
    dto: BankConfirmationImportDto,
  ): Promise<PayrunBankReconciliationResponse> {
    const batch = await this.resolveTargetBatch(payrunId, dto.payment_batch_id);
    if (!batch) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payment batch not found for this payrun' });
    }
    if (batch.exportStatus !== 'GENERATED') {
      throw new BadRequestException({
        code: 'BANK_IMPORT_EXPORT_STATE',
        message: 'Bank confirmation can only be recorded for a batch whose export is GENERATED.',
      });
    }

    const exportTotal = batch.payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    const exportEmployeeCount = batch.payments.length;
    const bankTotal = dto.bank_confirmed_total;
    const varianceAmount = exportTotal - bankTotal;

    const ctx = await this.govPolicy.resolvePayrunContext(payrunId);
    const feeTol = ctx
      ? await this.govPolicy.resolveNumberForContext(
          GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
          ctx,
          DEFAULT_BANK_TOTAL_TOLERANCE,
        )
      : {
          value: DEFAULT_BANK_TOTAL_TOLERANCE,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
        };
    const feeTolerance = feeTol.value;
    const feeMicroFloor = Math.min(0.005, feeTolerance);

    const hashInput = `${dto.bank_file_reference.trim()}|${dto.csv_text ?? ''}`;
    const bankFileHash = createHash('sha256').update(hashInput, 'utf8').digest('hex');

    const duplicate = await this.prisma.payrunBankReconciliation.findFirst({
      where: {
        organizationId: batch.organizationId,
        bankFileHash,
        paymentBatchId: { not: batch.id },
      },
    });

    const blockedReasons: string[] = [];
    const softWarnings: string[] = [];

    if (duplicate) {
      blockedReasons.push('DUPLICATE_SETTLEMENT_FILE');
    }
    if (exportEmployeeCount !== dto.bank_confirmed_employee_count) {
      blockedReasons.push('EMPLOYEE_COUNT_MISMATCH');
    }
    if (Math.abs(varianceAmount) > feeTolerance) {
      blockedReasons.push('BANK_TOTAL_MISMATCH');
    }

    const rejectedCount = dto.rejected_count ?? 0;
    const partialCount = dto.partial_count ?? 0;
    const rejectedCleared = dto.rejected_cleared === true;
    const partialCleared = dto.partial_cleared === true;

    if (dto.stale_confirmation === true) {
      softWarnings.push('STALE_CONFIRMATION');
    }
    if (Math.abs(varianceAmount) > 0 && Math.abs(varianceAmount) <= feeTolerance) {
      softWarnings.push('BANK_FEES_OR_DEDUCTIONS_POSSIBLE');
    }

    const blockedUnique = [...new Set(blockedReasons)];
    const softUnique = [...new Set(softWarnings)];

    let status: PayrunBankReconciliationStatus;
    let reviewRequired = false;

    if (blockedUnique.length > 0) {
      status = PayrunBankReconciliationStatus.BLOCKED;
      reviewRequired = true;
    } else if (rejectedCount > 0 && !rejectedCleared) {
      status = PayrunBankReconciliationStatus.REJECTED;
      reviewRequired = true;
    } else if (partialCount > 0 && !partialCleared) {
      status = PayrunBankReconciliationStatus.PARTIAL;
      reviewRequired = true;
    } else if (Math.abs(varianceAmount) >= feeMicroFloor && Math.abs(varianceAmount) <= feeTolerance) {
      status = PayrunBankReconciliationStatus.VARIANCE;
      reviewRequired = true;
    } else if (softUnique.length > 0) {
      status = PayrunBankReconciliationStatus.VARIANCE;
      reviewRequired = false;
    } else {
      status = PayrunBankReconciliationStatus.MATCH;
    }

    const confirmedAt = new Date();

    const row = await this.prisma.payrunBankReconciliation.upsert({
      where: { paymentBatchId: batch.id },
      create: {
        organizationId: batch.organizationId,
        payrunId,
        paymentBatchId: batch.id,
        bankFileReference: dto.bank_file_reference.trim(),
        bankFileHash,
        exportTotal: new Prisma.Decimal(exportTotal.toFixed(2)),
        bankConfirmedTotal: new Prisma.Decimal(bankTotal.toFixed(2)),
        exportEmployeeCount,
        bankConfirmedEmployeeCount: dto.bank_confirmed_employee_count,
        rejectedCount,
        partialCount,
        varianceAmount: new Prisma.Decimal(varianceAmount.toFixed(4)),
        status,
        sourceType: dto.source_type,
        confirmedAt,
        reviewRequired,
        reviewedByUserId: null,
        reviewedAt: null,
        softWarningsJson: softUnique,
        blockedReasonsJson: blockedUnique,
        importedByUserId: userId,
      },
      update: {
        bankFileReference: dto.bank_file_reference.trim(),
        bankFileHash,
        exportTotal: new Prisma.Decimal(exportTotal.toFixed(2)),
        bankConfirmedTotal: new Prisma.Decimal(bankTotal.toFixed(2)),
        exportEmployeeCount,
        bankConfirmedEmployeeCount: dto.bank_confirmed_employee_count,
        rejectedCount,
        partialCount,
        varianceAmount: new Prisma.Decimal(varianceAmount.toFixed(4)),
        status,
        sourceType: dto.source_type,
        confirmedAt,
        reviewRequired,
        reviewedByUserId: null,
        reviewedAt: null,
        softWarningsJson: softUnique,
        blockedReasonsJson: blockedUnique,
        importedByUserId: userId,
      },
    });

    const auditAction =
      status === PayrunBankReconciliationStatus.MATCH
        ? 'PAYRUN_BANK_RECON_MATCH'
        : status === PayrunBankReconciliationStatus.REJECTED
          ? 'PAYRUN_BANK_RECON_REJECTED'
          : 'PAYRUN_BANK_RECON_VARIANCE';

    await this.audit.log({
      userId,
      action: auditAction,
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: {
        payment_batch_id: batch.id,
        status,
        export_total: exportTotal,
        bank_confirmed_total: bankTotal,
        variance_amount: varianceAmount,
        blocked_reasons: blockedUnique,
        soft_warnings: softUnique,
        rejected_count: rejectedCount,
        partial_count: partialCount,
        governance_policy_key: feeTol.policy_key,
        governance_policy_id: feeTol.policy_id,
        governance_policy_source: feeTol.source,
        fee_tolerance_applied: feeTolerance,
      },
      reason: 'payrun_bank_reconciliation_import',
    });

    const impact = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { bankReconciliationImpacted: true },
    });
    return this.mapRow(row, impact?.bankReconciliationImpacted === true);
  }

  async acknowledgeBankReview(payrunId: string, userId: string, _note?: string): Promise<PayrunBankReconciliationResponse> {
    const row = await this.getControllingReconRow(payrunId);
    if (!row) {
      throw new NotFoundException({
        code: 'BANK_RECON_NOT_FOUND',
        message: 'Import bank confirmation before acknowledging review',
      });
    }
    if (
      row.status !== PayrunBankReconciliationStatus.VARIANCE &&
      row.status !== PayrunBankReconciliationStatus.REJECTED &&
      row.status !== PayrunBankReconciliationStatus.PARTIAL
    ) {
      throw new BadRequestException({
        code: 'BANK_RECON_REVIEW_INVALID',
        message: 'Review acknowledgement only applies when status is VARIANCE, REJECTED, or PARTIAL',
      });
    }
    if (row.reviewedAt) {
      throw new BadRequestException({
        code: 'BANK_RECON_ALREADY_REVIEWED',
        message: 'Bank reconciliation review was already recorded',
      });
    }
    if (row.status === PayrunBankReconciliationStatus.VARIANCE && !row.reviewRequired) {
      throw new BadRequestException({
        code: 'BANK_RECON_REVIEW_INVALID',
        message: 'This variance record does not require a separate review acknowledgement',
      });
    }

    const updated = await this.prisma.payrunBankReconciliation.update({
      where: { id: row.id },
      data: {
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewRequired: false,
      },
    });

    const ackAction =
      row.status === PayrunBankReconciliationStatus.REJECTED
        ? 'PAYRUN_BANK_RECON_REJECTED'
        : 'PAYRUN_BANK_RECON_VARIANCE';

    await this.audit.log({
      userId,
      action: ackAction,
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { reviewed: true, prior_status: row.status, payment_batch_id: row.paymentBatchId },
      reason: 'payrun_bank_reconciliation_review_acknowledged',
    });

    const impact = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { bankReconciliationImpacted: true },
    });
    return this.mapRow(updated, impact?.bankReconciliationImpacted === true);
  }

  private async resolveControllingBatchId(payrunId: string): Promise<string | null> {
    const fin = await this.prisma.payrunFinancialControl.findUnique({
      where: { payrunId },
      select: { paymentBatchId: true },
    });
    if (fin?.paymentBatchId) {
      return fin.paymentBatchId;
    }
    const b = await this.prisma.paymentBatch.findFirst({
      where: {
        payrunId,
        status: { notIn: ['CANCELLED', 'FAILED'] },
        exportStatus: 'GENERATED',
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return b?.id ?? null;
  }

  private async getControllingReconRow(payrunId: string) {
    const batchId = await this.resolveControllingBatchId(payrunId);
    if (!batchId) return null;
    return this.prisma.payrunBankReconciliation.findUnique({
      where: { paymentBatchId: batchId },
    });
  }

  private async resolveTargetBatch(payrunId: string, paymentBatchId?: string) {
    if (paymentBatchId) {
      return this.prisma.paymentBatch.findFirst({
        where: { id: paymentBatchId, payrunId },
        include: { payments: { select: { amount: true } } },
      });
    }
    return this.prisma.paymentBatch.findFirst({
      where: {
        payrunId,
        status: { notIn: ['CANCELLED', 'FAILED'] },
        exportStatus: 'GENERATED',
      },
      orderBy: { createdAt: 'desc' },
      include: { payments: { select: { amount: true } } },
    });
  }

  private mapRow(row: {
    payrunId: string;
    paymentBatchId: string;
    bankFileReference: string;
    bankFileHash: string | null;
    exportTotal: unknown;
    bankConfirmedTotal: unknown;
    exportEmployeeCount: number;
    bankConfirmedEmployeeCount: number;
    rejectedCount: number;
    partialCount: number;
    varianceAmount: unknown;
    status: PayrunBankReconciliationStatus;
    sourceType: PayrunBankConfirmationSourceType;
    confirmedAt: Date | null;
    reviewRequired: boolean;
    reviewedByUserId: string | null;
    reviewedAt: Date | null;
    softWarningsJson: unknown;
    blockedReasonsJson: unknown;
    importedAt: Date;
  }, postCloseReconciliationImpactPending: boolean): PayrunBankReconciliationResponse {
    return {
      payrun_id: row.payrunId,
      payment_batch_id: row.paymentBatchId,
      bank_file_reference: row.bankFileReference,
      bank_file_hash: row.bankFileHash,
      export_total: Number(row.exportTotal),
      bank_confirmed_total: Number(row.bankConfirmedTotal),
      export_employee_count: row.exportEmployeeCount,
      bank_confirmed_employee_count: row.bankConfirmedEmployeeCount,
      rejected_count: row.rejectedCount,
      partial_count: row.partialCount,
      variance_amount: Number(row.varianceAmount),
      status: row.status,
      source_type: row.sourceType,
      confirmed_at: row.confirmedAt?.toISOString() ?? null,
      review_required: row.reviewRequired,
      reviewed_by: row.reviewedByUserId,
      reviewed_at: row.reviewedAt?.toISOString() ?? null,
      soft_warnings: Array.isArray(row.softWarningsJson) ? (row.softWarningsJson as string[]) : [],
      blocked_reasons: Array.isArray(row.blockedReasonsJson) ? (row.blockedReasonsJson as string[]) : [],
      imported_at: row.importedAt.toISOString(),
      post_close_reconciliation_impact_pending: postCloseReconciliationImpactPending,
    };
  }
}
