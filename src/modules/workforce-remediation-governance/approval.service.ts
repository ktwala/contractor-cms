import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { WorkforceRemediationService } from '../workforce-remediation/workforce-remediation.service';
import { evaluatePolicy, PolicyEvaluation } from './policy-engine';
import { ApprovalRequestDto, GOVERNANCE_AUDIT_EVENTS } from './approval.types';

const TENANT_ID = 'default';

/** Pending approvals expire after 72 hours */
const APPROVAL_EXPIRY_HOURS = 72;
const EXPIRY_CHECK_INTERVAL_MS = 3600_000; // check hourly

@Injectable()
export class RemediationApprovalService {
  private readonly logger = new Logger(RemediationApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly remediationService: WorkforceRemediationService,
  ) {}

  checkPolicy(actionType: string, recordsAffected: number): PolicyEvaluation {
    return evaluatePolicy(actionType, recordsAffected);
  }

  async submitApprovalRequest(dto: ApprovalRequestDto, requestedByUserId: string) {
    const policy = evaluatePolicy(dto.actionType, dto.recordsAffected);
    if (!policy.requiresApproval) {
      throw new BadRequestException('This operation does not require approval. Execute directly.');
    }

    if (dto.recordsAffected <= 0) {
      throw new BadRequestException('Cannot request approval for zero records.');
    }

    // Idempotency: reject if there's already a PENDING request for this action+issue combo
    const existing = await this.prisma.workforceRemediationApproval.findFirst({
      where: {
        tenantId: TENANT_ID,
        actionType: dto.actionType,
        issueType: dto.issueType,
        status: 'PENDING',
      },
    });
    if (existing) {
      throw new BadRequestException(
        `A pending approval already exists for ${dto.actionType} (${dto.issueType}). Approve, reject, or wait for it to expire before submitting a new one.`,
      );
    }

    const approval = await this.prisma.workforceRemediationApproval.create({
      data: {
        tenantId: TENANT_ID,
        actionType: dto.actionType,
        issueType: dto.issueType,
        recordsAffected: dto.recordsAffected,
        requestedByUserId,
        previewSummary: (dto.previewSummary ?? {}) as any,
        fixPayload: (dto.fixPayload ?? {}) as any,
        filters: (dto.filters ?? {}) as any,
        status: 'PENDING',
      },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });

    await this.auditService.log({
      userId: requestedByUserId,
      action: GOVERNANCE_AUDIT_EVENTS.APPROVAL_REQUESTED,
      entityType: 'WorkforceRemediationApproval',
      entityId: approval.id,
      newValue: {
        actionType: dto.actionType,
        recordsAffected: dto.recordsAffected,
        issueType: dto.issueType,
      },
    });

    this.logger.log(`Approval request ${approval.id} created by ${requestedByUserId} for ${dto.actionType}`);
    return approval;
  }

  async listApprovals(filters?: {
    status?: string;
    requestedByUserId?: string;
    limit?: number;
    offset?: number;
  }) {
    const where: Record<string, unknown> = { tenantId: TENANT_ID };
    if (filters?.status) where.status = filters.status;
    if (filters?.requestedByUserId) where.requestedByUserId = filters.requestedByUserId;

    const [items, total] = await Promise.all([
      this.prisma.workforceRemediationApproval.findMany({
        where: where as any,
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 50,
        skip: filters?.offset ?? 0,
        include: {
          requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
          approver: { select: { id: true, firstName: true, lastName: true, email: true } },
        },
      }),
      this.prisma.workforceRemediationApproval.count({ where: where as any }),
    ]);

    return { items, total };
  }

  async getApprovalById(id: string) {
    const approval = await this.prisma.workforceRemediationApproval.findUnique({
      where: { id },
      include: {
        requestedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        approver: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
    });
    if (!approval) throw new NotFoundException('Approval request not found');
    return approval;
  }

  async approveRequest(approvalId: string, approverUserId: string) {
    const approval = await this.getApprovalById(approvalId);

    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve: status is ${approval.status}`);
    }

    if (approval.requestedByUserId === approverUserId) {
      throw new ForbiddenException('Segregation of duties: requester cannot approve their own remediation request.');
    }

    // Atomic CAS: only update if still PENDING (prevents race between concurrent approvers)
    const { count } = await this.prisma.workforceRemediationApproval.updateMany({
      where: { id: approvalId, status: 'PENDING' },
      data: { status: 'APPROVED', approverUserId, approvedAt: new Date() },
    });
    if (count === 0) {
      throw new BadRequestException('Approval was already processed by another user.');
    }

    const updated = await this.getApprovalById(approvalId);

    await this.auditService.log({
      userId: approverUserId,
      action: GOVERNANCE_AUDIT_EVENTS.APPROVED,
      entityType: 'WorkforceRemediationApproval',
      entityId: approvalId,
      newValue: { approvedBy: approverUserId, actionType: approval.actionType },
    });

    this.logger.log(`Approval ${approvalId} approved by ${approverUserId}`);
    return updated;
  }

  async rejectRequest(approvalId: string, approverUserId: string, reason?: string) {
    const approval = await this.getApprovalById(approvalId);

    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Cannot reject: status is ${approval.status}`);
    }

    // Atomic CAS: only update if still PENDING
    const { count } = await this.prisma.workforceRemediationApproval.updateMany({
      where: { id: approvalId, status: 'PENDING' },
      data: { status: 'REJECTED', approverUserId, rejectedAt: new Date(), rejectionReason: reason },
    });
    if (count === 0) {
      throw new BadRequestException('Approval was already processed by another user.');
    }

    const updated = await this.getApprovalById(approvalId);

    await this.auditService.log({
      userId: approverUserId,
      action: GOVERNANCE_AUDIT_EVENTS.REJECTED,
      entityType: 'WorkforceRemediationApproval',
      entityId: approvalId,
      newValue: { rejectedBy: approverUserId, reason, actionType: approval.actionType },
    });

    this.logger.log(`Approval ${approvalId} rejected by ${approverUserId}`);
    return updated;
  }

  async executeApproved(approvalId: string, executorUserId: string) {
    // Atomic CAS: transition APPROVED → EXECUTED to prevent double-execution
    const { count } = await this.prisma.workforceRemediationApproval.updateMany({
      where: { id: approvalId, status: 'APPROVED' },
      data: { status: 'EXECUTED', executedAt: new Date() },
    });
    if (count === 0) {
      const current = await this.getApprovalById(approvalId);
      throw new BadRequestException(
        current.status === 'EXECUTED'
          ? 'This approval has already been executed.'
          : `Cannot execute: status is ${current.status}. Must be APPROVED first.`,
      );
    }

    const approval = await this.getApprovalById(approvalId);
    const filters = approval.filters as any;
    const fix = approval.fixPayload as Record<string, unknown>;

    try {
      const result = await this.remediationService.apply(
        { issueType: approval.issueType, filters: filters || undefined, fix },
        executorUserId,
      );

      await this.auditService.log({
        userId: executorUserId,
        action: GOVERNANCE_AUDIT_EVENTS.EXECUTED,
        entityType: 'WorkforceRemediationApproval',
        entityId: approvalId,
        newValue: {
          actionType: approval.actionType,
          recordsUpdated: result.recordsUpdated,
          executedBy: executorUserId,
        },
      });

      this.logger.log(`Approval ${approvalId} executed by ${executorUserId}: ${result.recordsUpdated} records updated`);
      return { approval: { id: approvalId, status: 'EXECUTED' }, result };
    } catch (error) {
      // Roll back status to APPROVED so it can be retried
      await this.prisma.workforceRemediationApproval.updateMany({
        where: { id: approvalId, status: 'EXECUTED' },
        data: { status: 'APPROVED', executedAt: null },
      });
      this.logger.error(`Execution of approval ${approvalId} failed, status rolled back to APPROVED`, error);
      throw error;
    }
  }

  async getGovernanceAuditTrail(filters?: {
    limit?: number;
    offset?: number;
  }) {
    const governanceActions = [
      GOVERNANCE_AUDIT_EVENTS.APPROVAL_REQUESTED,
      GOVERNANCE_AUDIT_EVENTS.APPROVED,
      GOVERNANCE_AUDIT_EVENTS.REJECTED,
      GOVERNANCE_AUDIT_EVENTS.EXECUTED,
      GOVERNANCE_AUDIT_EVENTS.EXPIRED,
      GOVERNANCE_AUDIT_EVENTS.ISSUE_ASSIGNED,
      GOVERNANCE_AUDIT_EVENTS.ISSUE_UNASSIGNED,
      GOVERNANCE_AUDIT_EVENTS.ISSUE_DISMISSED,
      GOVERNANCE_AUDIT_EVENTS.ISSUE_REOPENED,
      'BULK_REMEDIATION',
    ];

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { action: { in: governanceActions } },
        orderBy: { createdAt: 'desc' },
        take: filters?.limit ?? 100,
        skip: filters?.offset ?? 0,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
      }),
      this.prisma.auditLog.count({ where: { action: { in: governanceActions } } }),
    ]);

    return {
      items: items.map((log: any) => ({
        id: log.id,
        event: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        detail: log.newValue as any,
        userName: log.user ? `${log.user.firstName} ${log.user.lastName}` : log.userId,
        userEmail: log.user?.email,
        createdAt: log.createdAt,
      })),
      total,
    };
  }

  // ─── Approval expiry ─────────────────────────────────────────

  @Interval(EXPIRY_CHECK_INTERVAL_MS)
  async expireStaleApprovals() {
    const cutoff = new Date(Date.now() - APPROVAL_EXPIRY_HOURS * 3600_000);

    // Fetch IDs before update so we can log each one
    const stale = await this.prisma.workforceRemediationApproval.findMany({
      where: { tenantId: TENANT_ID, status: 'PENDING', createdAt: { lt: cutoff } },
      select: { id: true, actionType: true, requestedByUserId: true },
    });

    if (stale.length === 0) return;

    await this.prisma.workforceRemediationApproval.updateMany({
      where: { id: { in: stale.map((s) => s.id) }, status: 'PENDING' },
      data: { status: 'EXPIRED' },
    });

    for (const s of stale) {
      await this.auditService.log({
        userId: 'system',
        action: GOVERNANCE_AUDIT_EVENTS.EXPIRED,
        entityType: 'WorkforceRemediationApproval',
        entityId: s.id,
        newValue: { actionType: s.actionType, reason: `Expired after ${APPROVAL_EXPIRY_HOURS}h` },
      });
    }

    this.logger.log(`Expired ${stale.length} stale approval request(s) older than ${APPROVAL_EXPIRY_HOURS}h`);
  }

  async getPendingCount() {
    return this.prisma.workforceRemediationApproval.count({
      where: { tenantId: TENANT_ID, status: 'PENDING' },
    });
  }
}
