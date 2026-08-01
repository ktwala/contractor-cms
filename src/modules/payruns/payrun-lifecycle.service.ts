import {
  Injectable,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunsService, RequestUser } from './payruns.service';
import { PayRunStatus, PAYRUN_STATE_TRANSITIONS } from '../../common/dto/enums.dto';
import { ApprovalsService } from '../approvals/approvals.service';
import { ApprovalEntityType } from '../approvals/dto/approval.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { NotificationType } from '../notifications/dto/notification.dto';
import { PayrunExceptionService } from './exceptions/payrun-exception.service';

@Injectable()
export class PayrunLifecycleService {
  private readonly logger = new Logger(PayrunLifecycleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly payrunsService: PayrunsService,
    @Inject(forwardRef(() => ApprovalsService))
    private readonly approvalsService: ApprovalsService,
    private readonly payrunExceptionService: PayrunExceptionService,
    @Optional()
    @Inject(forwardRef(() => NotificationsService))
    private readonly notificationsService?: NotificationsService,
  ) {}

  async submitForApproval(payrunId: string, note?: string, user?: RequestUser, reason?: string) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    this.validateTransition(payrun.status, PayRunStatus.IN_REVIEW);

    if (payrun.status !== PayRunStatus.CALCULATED) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'PayRun must be in CALCULATED status to submit for approval',
      });
    }

    const hasBlockers = await this.payrunExceptionService.hasSubmissionBlockers(payrunId);
    if (hasBlockers) {
      const summary = await this.payrunExceptionService.getExceptionSummary(payrunId);
      throw new ConflictException({
        code: 'SUBMISSION_BLOCKED',
        message: 'Cannot submit for approval: blocking payroll exceptions remain open',
        blockers: [
          { type: 'CRITICAL_EXCEPTIONS_OPEN', count: summary.blockingSubmissionCount },
        ],
      });
    }

    await this.assertHasEmployeeResults(payrunId);

    const updated = await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.IN_REVIEW,
        submittedByUserId: user?.sub,
        submittedAt: new Date(),
        notes: note ? `${payrun.notes || ''}\n[Submit] ${note}`.trim() : payrun.notes,
      },
      include: { payGroup: true },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_SUBMITTED',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.IN_REVIEW },
      reason,
    });

    return this.payrunsService.findOne(payrunId, user!);
  }

  /**
   * Submit PayRun for multi-level workflow approval
   * Uses the configured approval workflow for this pay group
   */
  async submitForWorkflowApproval(payrunId: string, note?: string, user?: RequestUser) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    if (payrun.status !== PayRunStatus.CALCULATED) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'PayRun must be in CALCULATED status to submit for approval',
      });
    }

    const hasBlockers = await this.payrunExceptionService.hasSubmissionBlockers(payrunId);
    if (hasBlockers) {
      const summary = await this.payrunExceptionService.getExceptionSummary(payrunId);
      throw new ConflictException({
        code: 'SUBMISSION_BLOCKED',
        message: 'Cannot submit for workflow approval: blocking payroll exceptions remain open',
        blockers: [
          { type: 'CRITICAL_EXCEPTIONS_OPEN', count: summary.blockingSubmissionCount },
        ],
      });
    }

    await this.assertHasEmployeeResults(payrunId);

    // Submit to approval workflow
    const approvalInstance = await this.approvalsService.submitForApproval(
      {
        entity_id: payrunId,
        entity_type: ApprovalEntityType.PAYRUN,
        note,
      },
      user!.sub,
    );

    // Update PayRun status to IN_REVIEW
    await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.IN_REVIEW,
        submittedByUserId: user?.sub,
        submittedAt: new Date(),
        notes: note ? `${payrun.notes || ''}\n[Workflow Submit] ${note}`.trim() : payrun.notes,
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_SUBMITTED',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.IN_REVIEW, workflow: true },
      reason: note,
    });

    this.logger.log(
      `PayRun ${payrunId} submitted for workflow approval (instance: ${approvalInstance.id})`,
    );

    return {
      payrun: await this.payrunsService.findOne(payrunId, user!),
      approval: approvalInstance,
    };
  }

  /**
   * Get approval status for a PayRun
   */
  async getApprovalStatus(payrunId: string) {
    return this.approvalsService.getApprovalForEntity(ApprovalEntityType.PAYRUN, payrunId);
  }

  async approve(payrunId: string, approvalComment?: string, user?: RequestUser, reason?: string) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    this.validateTransition(payrun.status, PayRunStatus.APPROVED);

    if (payrun.status !== PayRunStatus.IN_REVIEW) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'PayRun must be in IN_REVIEW status to approve',
      });
    }

    // PR-SOD-01: Creator cannot approve
    const createdBy = (payrun as any).created_by_user_id ?? (payrun as any).createdByUserId;
    if (createdBy && user?.sub && createdBy === user.sub) {
      await this.auditService.logSodDenied({
        userId: user.sub,
        ruleId: 'PR-SOD-01',
        entityType: 'PAYRUN',
        entityId: payrunId,
      });
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'Creator cannot approve the same payrun (PR-SOD-01)',
      });
    }

    const updated = await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.APPROVED,
        approvedByUserId: user?.sub,
        approvedAt: new Date(),
        lockedAt: new Date(),
        notes: approvalComment
          ? `${payrun.notes || ''}\n[Approved] ${approvalComment}`.trim()
          : payrun.notes,
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_APPROVED',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.APPROVED, approved_by: user?.sub },
      reason,
    });

    // Send notification
    await this.sendNotification(NotificationType.PAYRUN_APPROVED, payrunId, payrun, {
      approver_id: user?.sub,
    });

    return this.payrunsService.findOne(payrunId, user!);
  }

  async revertToDraft(payrunId: string, revertReason: string, user?: RequestUser, reason?: string) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    // Can only revert from certain states
    const revertableStates = [
      PayRunStatus.SNAPSHOT,
      PayRunStatus.CALCULATED,
      PayRunStatus.IN_REVIEW,
    ];

    if (!revertableStates.includes(payrun.status as PayRunStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Cannot revert PayRun from ${payrun.status} status`,
      });
    }

    const updated = await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.DRAFT,
        notes: `${payrun.notes || ''}\n[Reverted] ${revertReason}`.trim(),
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'REVERT_TO_DRAFT',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.DRAFT },
      reason: reason || revertReason,
    });

    return this.payrunsService.findOne(payrunId, user!);
  }

  /**
   * Governed terminal cancellation (PR-PAYRUN-CANCEL-1): abandon the run before execution / payment.
   * Does not delete historical rows; sets status CANCELLED and audits PAYRUN_CANCELLED.
   */
  async cancelPayrun(payrunId: string, cancelReason: string, user?: RequestUser, reason?: string) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    const allowed: PayRunStatus[] = [
      PayRunStatus.DRAFT,
      PayRunStatus.SNAPSHOT,
      PayRunStatus.CALCULATED,
      PayRunStatus.IN_REVIEW,
    ];
    if (!allowed.includes(payrun.status as PayRunStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: `Cannot cancel a payrun from ${payrun.status}. Cancellation is only allowed before approval/payment/posting.`,
      });
    }

    this.validateTransition(payrun.status as PayRunStatus, PayRunStatus.CANCELLED);

    const blockingBatch = await this.prisma.paymentBatch.findFirst({
      where: {
        payrunId,
        OR: [{ exportStatus: 'GENERATED' }, { status: { notIn: ['CANCELLED', 'FAILED'] } }],
      },
    });
    if (blockingBatch) {
      throw new ConflictException({
        code: 'PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH',
        message:
          'Cannot cancel: this payrun has a payment batch that is not fully voided, or an export was already generated. Use governed reversal/correction after money movement.',
        details: {
          batch_id: blockingBatch.id,
          batch_status: blockingBatch.status,
          export_status: blockingBatch.exportStatus,
        },
      });
    }

    await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.CANCELLED,
        notes: `${payrun.notes || ''}\n[Cancelled] ${cancelReason}`.trim(),
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_CANCELLED',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.CANCELLED, reason: cancelReason },
      reason: reason || cancelReason,
    });

    return this.payrunsService.findOne(payrunId, user!);
  }

  async markPaid(
    payrunId: string,
    paidAt: string,
    paymentReference: string,
    user?: RequestUser,
    reason?: string,
  ) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    if (payrun.status !== PayRunStatus.APPROVED && payrun.status !== PayRunStatus.POSTED) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'PayRun must be APPROVED or POSTED to mark as paid',
      });
    }

    const hasPaymentBlockers = await this.payrunExceptionService.hasPaymentBlockers(payrunId);
    if (hasPaymentBlockers) {
      const summary = await this.payrunExceptionService.getExceptionSummary(payrunId);
      throw new ConflictException({
        code: 'PAYMENT_BLOCKED',
        message: 'Cannot mark payrun as paid: payment-blocking exceptions remain open',
        blockers: [
          { type: 'PAYMENT_BLOCKING_EXCEPTIONS_OPEN', count: summary.blockingPaymentCount },
        ],
      });
    }

    // PR-SOD-02: Approver cannot mark paid
    const approvedBy = (payrun as any).approved_by ?? (payrun as any).approvedByUserId;
    if (approvedBy && user?.sub && approvedBy === user.sub) {
      await this.auditService.logSodDenied({
        userId: user.sub,
        ruleId: 'PR-SOD-02',
        entityType: 'PAYRUN',
        entityId: payrunId,
      });
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'Approver cannot mark the same payrun as paid (PR-SOD-02)',
      });
    }

    const updated = await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.PAID,
        paidByUserId: user?.sub,
        paidAt: new Date(paidAt),
        notes: `${payrun.notes || ''}\n[Paid] Ref: ${paymentReference} at ${paidAt}`.trim(),
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_PAID',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.PAID, payment_reference: paymentReference },
      reason,
    });

    // Send notification
    await this.sendNotification(NotificationType.PAYRUN_PAID, payrunId, payrun, {
      payment_reference: paymentReference,
    });

    return this.payrunsService.findOne(payrunId, user!);
  }

  async markPosted(
    payrunId: string,
    postedAt: string,
    glReference: string,
    user?: RequestUser,
    reason?: string,
  ) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    if (payrun.status !== PayRunStatus.APPROVED && payrun.status !== PayRunStatus.PAID) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'PayRun must be APPROVED or PAID to mark as posted',
      });
    }

    // PR-SOD-03 (optional): Payer cannot finalize/post - enforce that payer cannot post
    const paidBy = (payrun as any).paid_by_user_id ?? (payrun as any).paidByUserId;
    if (paidBy && user?.sub && paidBy === user.sub) {
      await this.auditService.logSodDenied({
        userId: user.sub,
        ruleId: 'PR-SOD-03',
        entityType: 'PAYRUN',
        entityId: payrunId,
      });
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'User who marked paid cannot post the same payrun (PR-SOD-03)',
      });
    }

    const updated = await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.POSTED,
        postedByUserId: user?.sub,
        postedAt: new Date(postedAt),
        notes: `${payrun.notes || ''}\n[Posted] GL Ref: ${glReference} at ${postedAt}`.trim(),
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_POSTED',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.POSTED, gl_reference: glReference },
      reason,
    });

    return this.payrunsService.findOne(payrunId, user!);
  }

  async finalize(payrunId: string, note?: string, user?: RequestUser, reason?: string) {
    const payrun = await this.payrunsService.findOne(payrunId, user!);

    if (payrun.status !== PayRunStatus.PAID && payrun.status !== PayRunStatus.POSTED) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'PayRun must be PAID or POSTED to finalize',
      });
    }

    // Finalization readiness checks
    const criticalExceptions = await this.prisma.payrunException.count({
      where: { payrunId, severity: 'CRITICAL', status: { in: ['OPEN', 'ASSIGNED'] } },
    });
    if (criticalExceptions > 0) {
      throw new ConflictException({
        code: 'FINALIZATION_BLOCKED',
        message: 'Cannot finalize: critical exceptions remain',
        blockers: [{ type: 'CRITICAL_EXCEPTIONS_OPEN', count: criticalExceptions }],
      });
    }

    const paymentBlockers = await this.prisma.payrunException.count({
      where: { payrunId, blocksPayment: true, status: { in: ['OPEN', 'ASSIGNED'] } },
    });
    if (paymentBlockers > 0) {
      throw new ConflictException({
        code: 'FINALIZATION_BLOCKED',
        message: 'Cannot finalize: payment-blocking exceptions remain',
        blockers: [{ type: 'PAYMENT_BLOCKERS_OPEN', count: paymentBlockers }],
      });
    }

    // Check required checklist tasks
    if ((payrun as any).periodId) {
      const checklist = await this.prisma.payrollChecklist.findFirst({
        where: { periodId: (payrun as any).periodId },
        select: { id: true },
      });
      if (checklist) {
        const incompleteTasks = await this.prisma.payrollChecklistTask.count({
          where: {
            checklistId: checklist.id,
            isRequired: true,
            status: { not: 'completed' },
          },
        });
        if (incompleteTasks > 0) {
          throw new ConflictException({
            code: 'FINALIZATION_BLOCKED',
            message: 'Required checklist tasks must be completed before finalization.',
            blockers: [{ type: 'CHECKLIST_INCOMPLETE', count: incompleteTasks }],
          });
        }
      }
    }

    // PR-SOD-03 (optional): Payer cannot finalize/post
    const paidBy = (payrun as any).paid_by_user_id ?? (payrun as any).paidByUserId;
    if (paidBy && user?.sub && paidBy === user.sub) {
      await this.auditService.logSodDenied({
        userId: user.sub,
        ruleId: 'PR-SOD-03',
        entityType: 'PAYRUN',
        entityId: payrunId,
      });
      throw new ForbiddenException({
        code: 'SOD_VIOLATION',
        message: 'User who marked paid cannot finalize the same payrun (PR-SOD-03)',
      });
    }

    const updated = await this.prisma.payRun.update({
      where: { id: payrunId },
      data: {
        status: PayRunStatus.FINALIZED,
        finalizedByUserId: user?.sub,
        finalizedAt: new Date(),
        notes: note ? `${payrun.notes || ''}\n[Finalized] ${note}`.trim() : payrun.notes,
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'PAYRUN_FINALIZED',
      entityType: 'PayRun',
      entityId: payrunId,
      oldValue: { status: payrun.status },
      newValue: { status: PayRunStatus.FINALIZED },
      reason,
    });

    // Send notification
    await this.sendNotification(NotificationType.PAYRUN_FINALIZED, payrunId, payrun, {});

    return this.payrunsService.findOne(payrunId, user!);
  }

  async createAdjustment(
    basePayrunId: string,
    adjustmentReason?: string,
    adjustmentMode: 'DELTA_ONLY' | 'FULL_RECALC' = 'DELTA_ONLY',
    includeEmployeeIds?: string[],
    user?: RequestUser,
    reason?: string,
  ) {
    await this.payrunsService.findOne(basePayrunId, user!);
    const basePayrun = await this.prisma.payRun.findUnique({
      where: { id: basePayrunId },
      include: { payGroup: true },
    });

    if (!basePayrun) {
      throw new BadRequestException({
        code: 'BASE_PAYRUN_NOT_FOUND',
        message: `Base PayRun with id '${basePayrunId}' not found`,
      });
    }

    if (basePayrun.status !== PayRunStatus.FINALIZED) {
      throw new ConflictException({
        code: 'INVALID_STATE',
        message: 'Can only create adjustment for a FINALIZED PayRun',
      });
    }

    const adjustmentPayrun = await this.prisma.payRun.create({
      data: {
        payGroupId: basePayrun.payGroupId,
        periodId: basePayrun.periodId,
        periodStart: basePayrun.periodStart,
        periodEnd: basePayrun.periodEnd,
        payDate: new Date(), // Adjustment pay date is today
        status: PayRunStatus.DRAFT,
        payrunType: 'ADJUSTMENT',
        basePayrunId,
        adjustmentReason,
        adjustmentMode,
        notes: `Adjustment for PayRun ${basePayrunId}`,
      },
    });

    await this.auditService.log({
      userId: user?.sub,
      action: 'CREATE_ADJUSTMENT',
      entityType: 'PayRun',
      entityId: adjustmentPayrun.id,
      newValue: {
        base_payrun_id: basePayrunId,
        adjustment_mode: adjustmentMode,
      },
      reason,
    });

    return this.payrunsService.findOne(adjustmentPayrun.id, user!);
  }

  /** Blocks submit-for-approval when calculate never persisted rows (empty register / engine gap). */
  private async assertHasEmployeeResults(payrunId: string): Promise<void> {
    const n = await this.prisma.employeeResult.count({ where: { payrunId } });
    if (n === 0) {
      throw new ConflictException({
        code: 'NO_EMPLOYEE_RESULTS',
        message:
          'Cannot submit for approval: no payroll calculation results exist for this payrun. Calculate with at least one employee in the register first.',
      });
    }
  }

  private validateTransition(currentStatus: PayRunStatus, targetStatus: PayRunStatus) {
    const allowedTransitions = PAYRUN_STATE_TRANSITIONS[currentStatus];

    if (!allowedTransitions || !allowedTransitions.includes(targetStatus)) {
      throw new ConflictException({
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot transition from ${currentStatus} to ${targetStatus}`,
      });
    }
  }

  private async sendNotification(
    type: NotificationType,
    payrunId: string,
    payrun: any,
    additionalData: Record<string, any>,
  ): Promise<void> {
    if (!this.notificationsService) {
      return;
    }

    try {
      await this.notificationsService.send({
        type,
        legal_entity_id: payrun.payGroup?.legalEntityId || payrun.legal_entity_id,
        pay_group_id: payrun.payGroupId || payrun.pay_group_id,
        data: {
          payrun_id: payrunId,
          pay_group_name: payrun.payGroup?.name || payrun.pay_group_name,
          period_start: payrun.periodStart || payrun.period_start,
          period_end: payrun.periodEnd || payrun.period_end,
          pay_date: payrun.payDate || payrun.pay_date,
          payrun_url: `/payruns/${payrunId}`,
          ...additionalData,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to send notification for payrun ${payrunId}:`, error);
    }
  }
}
