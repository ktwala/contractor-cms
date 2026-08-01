import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayRunStatus, PayRunType, PayrunReversalWorkflowStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';

export type PayrunReversalWorkflowRow = {
  id: string;
  source_payrun_id: string;
  reason: string;
  initiated_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  status: PayrunReversalWorkflowStatus;
  reversal_payrun_id: string | null;
  downstream_reconciliation_required: boolean;
  created_at: string;
  updated_at: string;
};

@Injectable()
export class PayrunReversalWorkflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private mapRow(r: {
    id: string;
    sourcePayrunId: string;
    reason: string;
    initiatedByUserId: string;
    approvedByUserId: string | null;
    approvedAt: Date | null;
    status: PayrunReversalWorkflowStatus;
    reversalPayrunId: string | null;
    downstreamReconciliationRequired: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): PayrunReversalWorkflowRow {
    return {
      id: r.id,
      source_payrun_id: r.sourcePayrunId,
      reason: r.reason,
      initiated_by_user_id: r.initiatedByUserId,
      approved_by_user_id: r.approvedByUserId,
      approved_at: r.approvedAt?.toISOString() ?? null,
      status: r.status,
      reversal_payrun_id: r.reversalPayrunId,
      downstream_reconciliation_required: r.downstreamReconciliationRequired,
      created_at: r.createdAt.toISOString(),
      updated_at: r.updatedAt.toISOString(),
    };
  }

  async listForSourcePayrun(sourcePayrunId: string): Promise<PayrunReversalWorkflowRow[]> {
    const rows = await this.prisma.payrunReversalWorkflow.findMany({
      where: { sourcePayrunId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.mapRow(r));
  }

  /**
   * Initiate a reversal workflow against a closed-period REGULAR payrun (GOV-3D-2).
   */
  async createRequest(sourcePayrunId: string, reason: string, actorUserId: string): Promise<PayrunReversalWorkflowRow> {
    const trimmed = (reason || '').trim();
    if (trimmed.length < 8) {
      throw new BadRequestException({
        code: 'REVERSAL_REASON_REQUIRED',
        message: 'Reversal reason must be at least 8 characters.',
      });
    }

    const payrun = await this.prisma.payRun.findUnique({
      where: { id: sourcePayrunId },
      include: { period: { select: { closedAt: true } } },
    });
    if (!payrun) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'PayRun not found' });
    }
    if (payrun.payrunType !== PayRunType.REGULAR) {
      throw new BadRequestException({
        code: 'REVERSAL_SOURCE_NOT_REGULAR',
        message: 'Reversal workflows may only be opened for REGULAR payruns.',
      });
    }
    if (!payrun.periodId || !payrun.period?.closedAt) {
      throw new BadRequestException({
        code: 'REVERSAL_REQUIRES_CLOSED_PERIOD',
        message: 'Reversal workflow requests require a linked pay period that is closed.',
      });
    }
    if (payrun.status !== PayRunStatus.FINALIZED) {
      throw new BadRequestException({
        code: 'REVERSAL_SOURCE_NOT_FINALIZED',
        message: 'Source payrun must be FINALIZED before a governed reversal can be requested.',
      });
    }

    const row = await this.prisma.payrunReversalWorkflow.create({
      data: {
        sourcePayrunId,
        reason: trimmed,
        initiatedByUserId: actorUserId,
        status: PayrunReversalWorkflowStatus.PENDING_APPROVAL,
        auditChain: [{ at: new Date().toISOString(), event: 'CREATED', actorUserId: actorUserId }],
      },
    });

    await this.audit.log({
      userId: actorUserId,
      action: 'PAYRUN_REVERSAL_WORKFLOW_CREATED',
      entityType: 'PayrunReversalWorkflow',
      entityId: row.id,
      newValue: { source_payrun_id: sourcePayrunId, status: row.status },
      reason: trimmed.slice(0, 500),
    });

    return this.mapRow(row);
  }

  async approve(workflowId: string, approverUserId: string): Promise<PayrunReversalWorkflowRow> {
    const wf = await this.prisma.payrunReversalWorkflow.findUnique({ where: { id: workflowId } });
    if (!wf) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reversal workflow not found' });
    }
    if (wf.status !== PayrunReversalWorkflowStatus.PENDING_APPROVAL) {
      throw new BadRequestException({
        code: 'REVERSAL_INVALID_STATE',
        message: `Workflow is not pending approval (status=${wf.status}).`,
      });
    }
    if (wf.initiatedByUserId === approverUserId) {
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'Initiator cannot approve the same reversal workflow.',
      });
    }

    const chain = Array.isArray(wf.auditChain) ? [...(wf.auditChain as object[])] : [];
    chain.push({ at: new Date().toISOString(), event: 'APPROVED', actorUserId: approverUserId });

    const updated = await this.prisma.payrunReversalWorkflow.update({
      where: { id: workflowId },
      data: {
        status: PayrunReversalWorkflowStatus.APPROVED,
        approvedByUserId: approverUserId,
        approvedAt: new Date(),
        auditChain: chain,
      },
    });

    await this.audit.log({
      userId: approverUserId,
      action: 'PAYRUN_REVERSAL_WORKFLOW_APPROVED',
      entityType: 'PayrunReversalWorkflow',
      entityId: workflowId,
      newValue: { source_payrun_id: wf.sourcePayrunId, status: updated.status },
      reason: 'reversal_workflow_approved',
    });

    return this.mapRow(updated);
  }

  /**
   * Link the compensating ADJUSTMENT payrun after it is created (immutable source remains).
   */
  async linkReversalPayrun(
    sourcePayrunId: string,
    workflowId: string,
    reversalPayrunId: string,
    actorUserId: string,
  ): Promise<PayrunReversalWorkflowRow> {
    const wf = await this.prisma.payrunReversalWorkflow.findFirst({
      where: { id: workflowId, sourcePayrunId },
    });
    if (!wf) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reversal workflow not found for this payrun' });
    }
    if (wf.status !== PayrunReversalWorkflowStatus.APPROVED) {
      throw new BadRequestException({
        code: 'REVERSAL_NOT_APPROVED',
        message: 'Workflow must be APPROVED before linking a reversal payrun.',
      });
    }

    const adj = await this.prisma.payRun.findUnique({ where: { id: reversalPayrunId } });
    if (!adj || adj.payrunType !== PayRunType.ADJUSTMENT || adj.basePayrunId !== sourcePayrunId) {
      throw new BadRequestException({
        code: 'REVERSAL_PAYRUN_INVALID',
        message: 'Reversal payrun must be an ADJUSTMENT with base_payrun_id equal to the source payrun.',
      });
    }

    const chain = Array.isArray(wf.auditChain) ? [...(wf.auditChain as object[])] : [];
    chain.push({
      at: new Date().toISOString(),
      event: 'LINKED_REVERSAL_PAYRUN',
      actorUserId,
      reversal_payrun_id: reversalPayrunId,
    });

    const [updated] = await this.prisma.$transaction([
      this.prisma.payrunReversalWorkflow.update({
        where: { id: workflowId },
        data: {
          reversalPayrunId,
          status: PayrunReversalWorkflowStatus.COMPLETED,
          auditChain: chain,
          downstreamReconciliationRequired: true,
        },
      }),
      this.prisma.payRun.update({
        where: { id: sourcePayrunId },
        data: {
          financialControlImpacted: true,
          bankReconciliationImpacted: true,
          glReconciliationImpacted: true,
        },
      }),
    ]);

    await this.audit.log({
      userId: actorUserId,
      action: 'PAYRUN_REVERSAL_WORKFLOW_LINKED',
      entityType: 'PayrunReversalWorkflow',
      entityId: workflowId,
      newValue: {
        reversal_payrun_id: reversalPayrunId,
        status: updated.status,
        gov4_post_close_impact: true,
      },
      reason: 'reversal_payrun_linked',
    });

    return this.mapRow(updated);
  }

  /**
   * Pre–adjustment-link only: once reversal_payrun_id is set, the closed REGULAR source must stay immutable.
   */
  async isApprovedWorkflowForSourceMutation(workflowId: string, sourcePayrunId: string): Promise<boolean> {
    const n = await this.prisma.payrunReversalWorkflow.count({
      where: {
        id: workflowId.trim(),
        sourcePayrunId,
        status: PayrunReversalWorkflowStatus.APPROVED,
        reversalPayrunId: null,
      },
    });
    return n > 0;
  }
}
