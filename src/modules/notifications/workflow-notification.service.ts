import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { EmailNotificationService } from './email-notification.service';

interface WorkflowNotificationOptions {
  workflowType: string;
  workflowId: string;
  workflowStatus: string;
  actorId?: string;
  actorName?: string;
  recipientId: string;
  subject: string;
  message: string;
  actionRequired?: boolean;
  actionUrl?: string;
  expiresIn?: number; // Hours
}

@Injectable()
export class WorkflowNotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailNotificationService,
  ) { }

  /**
   * Send workflow notification
   */
  async sendWorkflowNotification(options: WorkflowNotificationOptions): Promise<string> {
    // Get recipient details
    const user = await this.prisma.user.findUnique({
      where: { id: options.recipientId },
      select: { email: true, phone: true },
    });

    if (!user) {
      throw new Error('Recipient not found');
    }

    const expiresAt = options.expiresIn
      ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000)
      : null;

    // Create workflow notification record
    const notification = await this.prisma.workflowNotification.create({
      data: {
        workflowType: options.workflowType,
        workflowId: options.workflowId,
        workflowStatus: options.workflowStatus,
        actorId: options.actorId,
        actorName: options.actorName,
        recipientId: options.recipientId,
        recipientEmail: user.email,
        recipientPhone: user.phone,
        subject: options.subject,
        message: options.message,
        actionRequired: options.actionRequired || false,
        actionUrl: options.actionUrl,
        expiresAt,
      },
    });

    // Get user notification preferences
    const preferences = await this.getUserPreferences(options.recipientId);

    // Send via email if enabled
    if (preferences.emailEnabled && user.email) {
      try {
        await this.emailService.sendReminder(
          user.email,
          '', // Name will be fetched from email service
          options.workflowType,
          options.subject,
          this.buildEmailMessage(options)
        );

        await this.prisma.workflowNotification.update({
          where: { id: notification.id },
          data: { sentViaEmail: true, sentAt: new Date() },
        });
      } catch (error) {
        console.error('Failed to send workflow email:', error);
      }
    }

    // Create in-app notification
    await this.createInAppNotification(
      options.recipientId,
      options.workflowType,
      options.subject,
      options.message,
      options.actionUrl,
      options.actionRequired ? 'high' : 'medium'
    );

    await this.prisma.workflowNotification.update({
      where: { id: notification.id },
      data: { sentViaInApp: true },
    });

    return notification.id;
  }

  /**
   * Notify expense approval workflow
   */
  async notifyExpenseApproval(
    expenseId: string,
    status: string,
    approverId: string,
    employeeId: string,
    amount: number
  ) {
    const subject = status === 'approved'
      ? 'Your Expense Claim Has Been Approved'
      : 'Action Required: Expense Claim Pending Approval';

    const message = status === 'approved'
      ? `Your expense claim for R${amount.toFixed(2)} has been approved and will be processed in the next payment cycle.`
      : `You have a new expense claim for R${amount.toFixed(2)} pending your approval.`;

    return this.sendWorkflowNotification({
      workflowType: 'expense_approval',
      workflowId: expenseId,
      workflowStatus: status,
      actorId: status === 'submitted' ? employeeId : approverId,
      recipientId: status === 'submitted' ? approverId : employeeId,
      subject,
      message,
      actionRequired: status === 'submitted',
      actionUrl: `/expenses/${expenseId}`,
      expiresIn: 72, // 3 days
    });
  }

  /**
   * Notify leave approval workflow
   */
  async notifyLeaveApproval(
    leaveId: string,
    status: string,
    managerId: string,
    employeeId: string,
    leaveType: string,
    days: number
  ) {
    const subject = status === 'approved'
      ? 'Your Leave Request Has Been Approved'
      : status === 'rejected'
        ? 'Your Leave Request Has Been Declined'
        : 'Action Required: Leave Request Pending Approval';

    const message = status === 'approved'
      ? `Your ${leaveType} leave request for ${days} day(s) has been approved.`
      : status === 'rejected'
        ? `Your ${leaveType} leave request for ${days} day(s) has been declined. Please contact your manager for more information.`
        : `You have a new ${leaveType} leave request for ${days} day(s) pending your approval.`;

    return this.sendWorkflowNotification({
      workflowType: 'leave_approval',
      workflowId: leaveId,
      workflowStatus: status,
      actorId: status === 'submitted' ? employeeId : managerId,
      recipientId: status === 'submitted' ? managerId : employeeId,
      subject,
      message,
      actionRequired: status === 'submitted',
      actionUrl: `/leave/${leaveId}`,
      expiresIn: 48, // 2 days
    });
  }

  /**
   * Notify loan approval workflow
   */
  async notifyLoanApproval(
    loanId: string,
    status: string,
    approverId: string,
    employeeId: string,
    amount: number,
    loanType: string
  ) {
    const subject = status === 'approved'
      ? 'Your Loan Application Has Been Approved'
      : status === 'rejected'
        ? 'Your Loan Application Status Update'
        : 'Action Required: Loan Application Pending Approval';

    const message = status === 'approved'
      ? `Your ${loanType} loan application for R${amount.toFixed(2)} has been approved.`
      : status === 'rejected'
        ? `Your ${loanType} loan application for R${amount.toFixed(2)} requires further review. Please contact HR.`
        : `You have a new ${loanType} loan application for R${amount.toFixed(2)} pending your approval.`;

    return this.sendWorkflowNotification({
      workflowType: 'loan_approval',
      workflowId: loanId,
      workflowStatus: status,
      actorId: status === 'submitted' ? employeeId : approverId,
      recipientId: status === 'submitted' ? approverId : employeeId,
      subject,
      message,
      actionRequired: status === 'submitted',
      actionUrl: `/loans/${loanId}`,
      expiresIn: 120, // 5 days
    });
  }

  /**
   * Notify overtime approval
   */
  async notifyOvertimeApproval(
    overtimeId: string,
    status: string,
    managerId: string,
    employeeId: string,
    hours: number
  ) {
    const subject = status === 'approved'
      ? 'Your Overtime Request Has Been Approved'
      : 'Action Required: Overtime Request Pending Approval';

    const message = status === 'approved'
      ? `Your overtime request for ${hours} hours has been approved.`
      : `You have a new overtime request for ${hours} hours pending your approval.`;

    return this.sendWorkflowNotification({
      workflowType: 'overtime_approval',
      workflowId: overtimeId,
      workflowStatus: status,
      actorId: status === 'submitted' ? employeeId : managerId,
      recipientId: status === 'submitted' ? managerId : employeeId,
      subject,
      message,
      actionRequired: status === 'submitted',
      actionUrl: `/time-attendance/overtime/${overtimeId}`,
      expiresIn: 24, // 1 day
    });
  }

  /**
   * Notify performance review
   */
  async notifyPerformanceReview(
    reviewId: string,
    status: string,
    reviewerId: string,
    employeeId: string,
    reviewPeriod: string
  ) {
    const subject = status === 'pending_self_assessment'
      ? 'Action Required: Complete Your Self-Assessment'
      : status === 'pending_manager_review'
        ? 'Action Required: Employee Performance Review'
        : 'Your Performance Review Has Been Completed';

    const message = status === 'pending_self_assessment'
      ? `Please complete your self-assessment for the ${reviewPeriod} performance review.`
      : status === 'pending_manager_review'
        ? `Please complete the performance review for your team member for ${reviewPeriod}.`
        : `Your performance review for ${reviewPeriod} has been completed and is available for viewing.`;

    return this.sendWorkflowNotification({
      workflowType: 'performance_review',
      workflowId: reviewId,
      workflowStatus: status,
      actorId: reviewerId,
      recipientId: status === 'pending_manager_review' ? reviewerId : employeeId,
      subject,
      message,
      actionRequired: status.includes('pending'),
      actionUrl: `/performance/reviews/${reviewId}`,
      expiresIn: 168, // 7 days
    });
  }

  /**
   * Get user notification preferences
   */
  private async getUserPreferences(userId: string): Promise<any> {
    // Get first preference for user (the original model uses composite key [userId, type])
    const prefs = await this.prisma.notificationPreference.findFirst({
      where: { userId },
    });

    if (!prefs) {
      // Return default preferences
      return {
        emailEnabled: true,
        smsEnabled: false,
        emailExpenseApprovals: true,
        emailLeaveApprovals: true,
        emailLoanUpdates: true,
      };
    }


    return prefs;
  }

  /**
   * Build email message with action button
   */
  private buildEmailMessage(options: WorkflowNotificationOptions): string {
    let message = options.message;

    if (options.actionRequired && options.actionUrl) {
      message += `\n\nPlease click the link below to take action:\n${options.actionUrl}`;
    }

    if (options.actorName) {
      message = `${options.actorName} has submitted a request.\n\n${message}`;
    }

    return message;
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    notificationType: string,
    title: string,
    message: string,
    actionUrl?: string,
    priority: string = 'medium'
  ) {
    await this.prisma.inAppNotification.create({
      data: {
        userId,
        notificationType,
        title,
        message,
        actionUrl,
        priority,
      },
    });
  }

  /**
   * Mark workflow notification as read
   */
  async markAsRead(notificationId: string) {
    await this.prisma.workflowNotification.update({
      where: { id: notificationId },
      data: { status: 'read', readAt: new Date() },
    });
  }

  /**
   * Mark workflow notification as actioned
   */
  async markAsActioned(notificationId: string) {
    await this.prisma.workflowNotification.update({
      where: { id: notificationId },
      data: { status: 'actioned', actionedAt: new Date() },
    });
  }

  /**
   * Get workflow notifications for a user
   */
  async getUserWorkflowNotifications(userId: string, filters?: {
    status?: string;
    workflow_type?: string;
    limit?: number;
  }) {
    return this.prisma.workflowNotification.findMany({
      where: {
        recipientId: userId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.workflow_type && { workflowType: filters.workflow_type }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 50,
    });
  }
}
