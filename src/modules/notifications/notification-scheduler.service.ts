import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import { EmailNotificationService } from './email-notification.service';

@Injectable()
export class NotificationSchedulerService {
  private readonly logger = new Logger(NotificationSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailNotificationService,
  ) { }

  /**
   * Process pending alert schedules (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processAlertSchedules() {
    this.logger.log('Processing alert schedules...');

    try {
      // Get alerts that are due to run
      const alerts = await this.prisma.alertSchedule.findMany({
        where: {
          isActive: true,
          OR: [
            { nextRunAt: null },
            { nextRunAt: { lte: new Date() } },
          ],
        },
        orderBy: [
          { priority: 'desc' },
          { nextRunAt: 'asc' },
        ],
        take: 50,
      });

      for (const alert of alerts) {
        try {
          await this.executeAlert(alert);
        } catch (error) {
          this.logger.error(`Failed to execute alert ${alert.id}:`, error);
        }
      }

      this.logger.log(`Processed ${alerts.length} alerts`);
    } catch (error) {
      this.logger.error('Failed to process alert schedules:', error);
    }
  }

  /**
   * Process scheduled reports (runs every hour)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledReports() {
    this.logger.log('Processing scheduled reports...');

    try {
      const reports = await this.prisma.scheduledReport.findMany({
        where: {
          isActive: true,
          OR: [
            { nextRunAt: null },
            { nextRunAt: { lte: new Date() } },
          ],
        },
        take: 20,
      });

      for (const report of reports) {
        try {
          await this.executeScheduledReport(report);
        } catch (error) {
          this.logger.error(`Failed to execute report ${report.id}:`, error);
        }
      }

      this.logger.log(`Processed ${reports.length} scheduled reports`);
    } catch (error) {
      this.logger.error('Failed to process scheduled reports:', error);
    }
  }

  /**
   * Send EMP201 deadline reminders (runs daily at 9 AM)
   */
  @Cron('0 9 * * *')
  async sendEMP201DeadlineReminders() {
    this.logger.log('Checking for EMP201 deadline reminders...');

    try {
      const today = new Date();
      const dayOfMonth = today.getDate();

      // Send reminder on the 5th of each month (2 days before deadline)
      if (dayOfMonth === 5) {
        await this.sendDeadlineReminder(
          'emp201_submission',
          'EMP201 Submission Reminder',
          'The EMP201 monthly return is due on the 7th. Please ensure all submissions are completed.',
          ['TENANT_ADMIN', 'PAYROLL_CLERK']
        );
      }
    } catch (error) {
      this.logger.error('Failed to send EMP201 reminders:', error);
    }
  }

  /**
   * Send payroll processing reminders (runs daily at 9 AM)
   */
  @Cron('0 9 25 * *')
  async sendPayrollProcessingReminder() {
    this.logger.log('Sending payroll processing reminder...');

    try {
      await this.sendDeadlineReminder(
        'payroll_processing',
        'Monthly Payroll Processing Reminder',
        'Please ensure monthly payroll is processed by month-end.',
        ['TENANT_ADMIN', 'PAYROLL_CLERK']
      );
    } catch (error) {
      this.logger.error('Failed to send payroll reminders:', error);
    }
  }

  /**
   * Clean up old notifications (runs daily at 2 AM)
   */
  @Cron('0 2 * * *')
  async cleanupOldNotifications() {
    this.logger.log('Cleaning up old notifications...');

    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      // Archive read in-app notifications older than 30 days
      await this.prisma.inAppNotification.updateMany({
        where: {
          isRead: true,
          readAt: { lt: thirtyDaysAgo },
          isArchived: false,
        },
        data: {
          isArchived: true,
          archivedAt: new Date(),
        },
      });

      // Delete archived notifications older than 90 days
      await this.prisma.inAppNotification.deleteMany({
        where: {
          isArchived: true,
          archivedAt: { lt: ninetyDaysAgo },
        },
      });

      // Delete old notification logs (keep 6 months)
      await this.prisma.notificationLog.deleteMany({
        where: {
          createdAt: { lt: sixMonthsAgo },
        },
      });

      this.logger.log('Notification cleanup completed');
    } catch (error) {
      this.logger.error('Failed to cleanup notifications:', error);
    }
  }

  /**
   * Retry failed email notifications (runs every 6 hours)
   */
  @Cron('0 */6 * * *')
  async retryFailedNotifications() {
    this.logger.log('Retrying failed notifications...');

    try {
      const result = await this.emailService.retryFailedNotifications();
      this.logger.log(`Retried ${result.retried} failed notifications: ${result.succeeded} succeeded, ${result.failed} failed`);
    } catch (error) {
      this.logger.error('Failed to retry notifications:', error);
    }
  }

  /**
   * Execute an alert
   */
  private async executeAlert(alert: any) {
    this.logger.log(`Executing alert: ${alert.alertName}`);

    // Get recipients based on target type
    const recipients = await this.getAlertRecipients(alert.targetType, alert.targetValue);

    // Send notifications via configured channels
    for (const recipient of recipients) {
      try {
        if (alert.sendEmail && recipient.email) {
          await this.emailService.sendReminder(
            recipient.email,
            recipient.name,
            alert.alertType,
            alert.subject,
            alert.message
          );
        }

        if (alert.sendInApp && recipient.userId) {
          await this.createInAppNotification(
            recipient.userId,
            alert.alertType,
            alert.subject,
            alert.message,
            alert.priority
          );
        }
      } catch (error) {
        this.logger.error(`Failed to send alert to ${recipient.email}:`, error);
      }
    }

    // Update alert schedule
    await this.updateAlertSchedule(alert.id, alert.cronExpression);
  }

  /**
   * Execute a scheduled report
   */
  private async executeScheduledReport(report: any) {
    this.logger.log(`Executing scheduled report: ${report.reportName}`);

    // In production, this would generate the actual report
    // For now, we'll just log and update the schedule

    try {
      // Update report schedule
      await this.prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunAt: new Date(),
          lastRunStatus: 'completed',
          runCount: { increment: 1 },
        },
      });

      // Calculate next run time based on schedule_type
      await this.updateReportSchedule(report.id, report.scheduleType);

      this.logger.log(`Scheduled report ${report.reportName} executed successfully`);
    } catch (error: any) {
      await this.prisma.scheduledReport.update({
        where: { id: report.id },
        data: {
          lastRunStatus: 'failed',
          lastRunError: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Get alert recipients based on target type
   */
  private async getAlertRecipients(targetType: string, targetValue: string | null): Promise<any[]> {
    switch (targetType) {
      case 'all_users':
        const allUsers = await this.prisma.user.findMany({
          where: { isActive: true },
          select: { id: true, email: true, firstName: true, lastName: true },
        });
        return allUsers.map(u => ({
          userId: u.id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
        }));

      case 'role':
        const roleUsers = await this.prisma.user.findMany({
          where: {
            isActive: true,
            userRoles: {
              some: {
                role: { name: targetValue as any },
              },
            },
          },
          select: { id: true, email: true, firstName: true, lastName: true },
        });
        return roleUsers.map(u => ({
          userId: u.id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
        }));

      case 'specific_users':
        const userIds = JSON.parse(targetValue || '[]');
        if (userIds.length === 0) return [];

        const specificUsers = await this.prisma.user.findMany({
          where: {
            id: { in: userIds },
            isActive: true,
          },
          select: { id: true, email: true, firstName: true, lastName: true },
        });
        return specificUsers.map(u => ({
          userId: u.id,
          email: u.email,
          name: `${u.firstName} ${u.lastName}`,
        }));

      default:
        return [];
    }
  }

  /**
   * Send deadline reminder to specific roles
   */
  private async sendDeadlineReminder(
    reminderType: string,
    subject: string,
    message: string,
    roles: string[]
  ) {
    for (const role of roles) {
      const recipients = await this.getAlertRecipients('role', role);

      for (const recipient of recipients) {
        try {
          // Send email
          await this.emailService.sendReminder(
            recipient.email,
            recipient.name,
            reminderType,
            subject,
            message
          );

          // Create in-app notification
          await this.createInAppNotification(
            recipient.userId,
            reminderType,
            subject,
            message,
            'high'
          );
        } catch (error) {
          this.logger.error(`Failed to send reminder to ${recipient.email}:`, error);
        }
      }
    }
  }

  /**
   * Create in-app notification
   */
  private async createInAppNotification(
    userId: string,
    notificationType: string,
    title: string,
    message: string,
    priority: string = 'medium'
  ) {
    await this.prisma.inAppNotification.create({
      data: {
        userId,
        notificationType,
        title,
        message,
        priority,
      },
    });
  }

  /**
   * Update alert schedule for next run
   */
  private async updateAlertSchedule(alertId: string, cronExpression: string | null) {
    // Simple next run calculation (in production, use a proper cron parser)
    const nextRun = new Date();
    nextRun.setHours(nextRun.getHours() + 24); // Default: next day

    await this.prisma.alertSchedule.update({
      where: { id: alertId },
      data: {
        lastRunAt: new Date(),
        nextRunAt: nextRun,
        runCount: { increment: 1 },
      },
    });
  }

  /**
   * Update report schedule for next run
   */
  private async updateReportSchedule(reportId: string, scheduleType: string) {
    const nextRun = new Date();

    switch (scheduleType) {
      case 'daily':
        nextRun.setDate(nextRun.getDate() + 1);
        break;
      case 'weekly':
        nextRun.setDate(nextRun.getDate() + 7);
        break;
      case 'monthly':
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;
      case 'quarterly':
        nextRun.setMonth(nextRun.getMonth() + 3);
        break;
      case 'yearly':
        nextRun.setFullYear(nextRun.getFullYear() + 1);
        break;
    }

    await this.prisma.scheduledReport.update({
      where: { id: reportId },
      data: { nextRunAt: nextRun },
    });
  }
}
