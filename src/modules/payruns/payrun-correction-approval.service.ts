import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayRunType, PayrunCorrectionApprovalStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

export type PayrunCorrectionApprovalRow = {
  id: string;
  payrun_id: string;
  requested_change_scope: string;
  requested_by_user_id: string;
  approver_user_id: string | null;
  approved_at: string | null;
  approval_reference: string;
  resulting_adjustment_payrun_id: string | null;
  status: PayrunCorrectionApprovalStatus;
  downstream_reconciliation_required: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class PayrunCorrectionApprovalService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private mapRow(r: {
    id: string;
    payrunId: string;
    requestedChangeScope: string;
    requestedByUserId: string;
    approverUserId: string | null;
    approvedAt: Date | null;
    approvalReference: string;
    resultingAdjustmentPayrunId: string | null;
    status: PayrunCorrectionApprovalStatus;
    downstreamReconciliationRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): PayrunCorrectionApprovalRow {
    return {
      id: r.id,
      payrun_id: r.payrunId,
      requested_change_scope: r.requestedChangeScope,
      requested_by_user_id: r.requestedByUserId,
      approver_user_id: r.approverUserId,
      approved_at: r.approvedAt?.toISOString() ?? null,
      approval_reference: r.approvalReference,
      resulting_adjustment_payrun_id: r.resultingAdjustmentPayrunId,
      status: r.status,
      downstream_reconciliation_required: r.downstreamReconciliationRequired,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    };
  }

  async listForPayrun(payrunId: string): Promise<PayrunCorrectionApprovalRow[]> {
    const rows = await this.prisma.payrunCorrectionApproval.findMany({
      where: { payrunId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Request a correction approval for a closed-period REGULAR payrun (GOV-3D-2).
   */
  async createRequest(
    payrunId: string,
    requestedChangeScope: string,
    actorUserId: string,
  ): Promise<PayrunCorrectionApprovalRow> {
    const scope = (requestedChangeScope || '').trim();
    if (scope.length < 8) {
      throw new BadRequestException({
        code: 'CORRECTION_SCOPE_REQUIRED',
        message: 'requested_change_scope must be at least 8 characters.',
      });
    }

    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: { period: { select: { closedAt: true } } },
    });
    if (!payrun) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'PayRun not found' });
    }
    if (payrun.payrunType !== PayRunType.REGULAR) {
      throw new BadRequestException({
        code: 'CORRECTION_PAYRUN_NOT_REGULAR',
        message: 'Correction approvals apply to REGULAR payruns only.',
      });
    }
    if (!payrun.periodId || !payrun.period?.closedAt) {
      throw new BadRequestException({
        code: 'CORRECTION_REQUIRES_CLOSED_PERIOD',
        message: 'Correction approvals require a linked pay period that is closed.',
      });
    }

    const approvalReference = randomUUID();

    const row = await this.prisma.payrunCorrectionApproval.create({
      data: {
        payrunId,
        requestedChangeScope: scope,
        requestedByUserId: actorUserId,
        approvalReference,
        status: PayrunCorrectionApprovalStatus.PENDING,
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'PAYRUN_CORRECTION_APPROVAL_CREATED',
      entityType: 'PayrunCorrectionApproval',
      entityId: row.id,
      newValue: { payrun_id: payrunId, approval_reference: approvalReference, status: row.status },
      reason: scope.slice(0, 500),
    });

    return this.mapRow(row);
  }

  async approve(approvalId: string, approverUserId: string): Promise<PayrunCorrectionApprovalRow> {
    const row = await this.prisma.payrunCorrectionApproval.findUnique({ where: { id: approvalId } });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Correction approval not found' });
    }
    if (row.status !== PayrunCorrectionApprovalStatus.PENDING) {
      throw new BadRequestException({
        code: 'CORRECTION_INVALID_STATE',
        message: `Correction approval is not pending (status=${row.status}).`,
      });
    }
    if (row.requestedByUserId === approverUserId) {
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'Requester cannot approve the same correction approval.',
      });
    }

    const updated = await this.prisma.payrunCorrectionApproval.update({
      where: { id: approvalId },
      data: {
        status: PayrunCorrectionApprovalStatus.APPROVED,
        approverUserId: approverUserId,
        approvedAt: new Date(),
      },
    });

    await this.audit.log({
      userId: approverUserId,
      action: 'PAYRUN_CORRECTION_APPROVAL_APPROVED',
      entityType: 'PayrunCorrectionApproval',
      entityId: approvalId,
      newValue: { payrun_id: row.payrunId, status: updated.status },
      reason: 'correction_approval_approved',
    });

    return this.mapRow(updated);
  }

  /**
   * Record the adjustment payrun that implements the approved correction.
   */
  async linkAdjustmentPayrun(
    payrunId: string,
    approvalId: string,
    adjustmentPayrunId: string,
    actorUserId: string,
  ): Promise<PayrunCorrectionApprovalRow> {
    const row = await this.prisma.payrunCorrectionApproval.findFirst({
      where: { id: approvalId, payrunId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Correction approval not found for this payrun' });
    }
    if (row.status !== PayrunCorrectionApprovalStatus.APPROVED) {
      throw new BadRequestException({
        code: 'CORRECTION_NOT_APPROVED',
        message: 'Correction must be APPROVED before linking an adjustment payrun.',
      });
    }

    const adj = await this.prisma.payRun.findUnique({ where: { id: adjustmentPayrunId } });
    if (!adj || adj.payrunType !== PayRunType.ADJUSTMENT || adj.basePayrunId !== payrunId) {
      throw new BadRequestException({
        code: 'CORRECTION_ADJUSTMENT_INVALID',
        message: 'Adjustment payrun must be ADJUSTMENT with base_payrun_id equal to the approved payrun.',
      });
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.payrunCorrectionApproval.update({
        where: { id: approvalId },
        data: {
          resultingAdjustmentPayrunId: adjustmentPayrunId,
          status: PayrunCorrectionApprovalStatus.APPLIED,
          downstreamReconciliationRequired: true,
        },
      }),
      this.prisma.payRun.update({
        where: { id: payrunId },
        data: {
          financialControlImpacted: true,
          bankReconciliationImpacted: true,
          glReconciliationImpacted: true,
        },
      }),
    ]);

    await this.audit.log({
      userId: actorUserId,
      action: 'PAYRUN_CORRECTION_APPROVAL_APPLIED',
      entityType: 'PayrunCorrectionApproval',
      entityId: approvalId,
      newValue: {
        resulting_adjustment_payrun_id: adjustmentPayrunId,
        status: updated.status,
        gov4_post_close_impact: true,
      },
      reason: 'correction_adjustment_linked',
    });

    return this.mapRow(updated);
  }

  /**
   * Pre–adjustment-link only: after resulting_adjustment_payrun_id is set, the closed REGULAR source stays immutable.
   */
  async isApprovedCorrectionForSourceMutation(headerValue: string, payrunId: string): Promise<boolean> {
    const v = (headerValue || '').trim();
    if (v.length < 8) return false;
    const n = await this.prisma.payrunCorrectionApproval.count({
      where: {
        payrunId,
        status: PayrunCorrectionApprovalStatus.APPROVED,
        resultingAdjustmentPayrunId: null,
        OR: [{ id: v }, { approvalReference: v }],
      },
    });
    return n > 0;
  }
}
