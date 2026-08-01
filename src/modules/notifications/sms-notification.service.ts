import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import twilio from 'twilio';

interface SMSOptions {
  to: string;
  toName?: string;
  message: string;
  documentType?: string;
  documentId?: string;
  notificationType?: string;
}

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);
  private twilioClient: twilio.Twilio;
  private fromNumber: string;

  constructor(private readonly prisma: PrismaService) {
    // Initialize Twilio client
    const accountSid = process.env.TWILIO_ACCOUNT_SID || '';
    const authToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.fromNumber = process.env.TWILIO_PHONE_NUMBER || '';

    if (accountSid && authToken) {
      this.twilioClient = twilio(accountSid, authToken);
    } else {
      this.logger.warn('Twilio credentials not configured. SMS functionality will be disabled.');
    }
  }

  /**
   * Send SMS notification
   */
  async sendSMS(options: SMSOptions): Promise<string> {
    // Create notification record
    const notification = await this.prisma.smsNotification.create({
      data: {
        notificationType: options.notificationType || 'general',
        recipientPhone: options.to,
        recipientName: options.toName,
        message: options.message,
        documentType: options.documentType,
        documentId: options.documentId,
        status: 'pending',
        provider: 'twilio',
      },
    });

    try {
      // Check if Twilio is configured
      if (!this.twilioClient) {
        throw new Error('Twilio is not configured');
      }

      // Format phone number (ensure it has country code)
      const formattedPhone = this.formatPhoneNumber(options.to);

      // Send SMS
      const message = await this.twilioClient.messages.create({
        body: options.message,
        from: this.fromNumber,
        to: formattedPhone,
      });

      // Update notification status
      await this.markAsSent(notification.id, message.sid);

      this.logger.log(`SMS sent successfully to ${formattedPhone}`);
      return notification.id;
    } catch (error: any) {
      // Update notification status to failed
      await this.markAsFailed(notification.id, error.message);
      this.logger.error(`Failed to send SMS to ${options.to}:`, error);
      throw error;
    }
  }

  /**
   * Send critical alert SMS
   */
  async sendCriticalAlert(phoneNumber: string, recipientName: string, alertMessage: string): Promise<string> {
    return this.sendSMS({
      to: phoneNumber,
      toName: recipientName,
      message: `[CRITICAL ALERT] ${alertMessage}`,
      notificationType: 'critical_alert',
    });
  }

  /**
   * Send EMP201 deadline reminder SMS
   */
  async sendEMP201Reminder(phoneNumber: string, recipientName: string): Promise<string> {
    const message = `Reminder: EMP201 monthly return is due on the 7th. Please ensure all submissions are completed. - Payroll System`;

    return this.sendSMS({
      to: phoneNumber,
      toName: recipientName,
      message,
      notificationType: 'emp201_reminder',
    });
  }

  /**
   * Send payroll processing complete SMS
   */
  async sendPayrollCompleteNotification(phoneNumber: string, recipientName: string, payrunId: string): Promise<string> {
    const message = `Your payroll for this month has been processed successfully. Your payslip is now available. - Payroll System`;

    return this.sendSMS({
      to: phoneNumber,
      toName: recipientName,
      message,
      notificationType: 'payroll_complete',
      documentType: 'payrun',
      documentId: payrunId,
    });
  }

  /**
   * Send approval request SMS
   */
  async sendApprovalRequestSMS(
    phoneNumber: string,
    recipientName: string,
    workflowType: string,
    workflowId: string
  ): Promise<string> {
    const message = `You have a new ${workflowType.replace('_', ' ')} request pending your approval. Please check the system. - Payroll System`;

    return this.sendSMS({
      to: phoneNumber,
      toName: recipientName,
      message,
      notificationType: `${workflowType}_approval`,
      documentType: workflowType,
      documentId: workflowId,
    });
  }

  /**
   * Bulk send SMS notifications
   */
  async bulkSendSMS(recipients: Array<{ phone: string; name?: string; message: string }>): Promise<{
    total: number;
    sent: number;
    failed: number;
    results: any[];
  }> {
    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        const notificationId = await this.sendSMS({
          to: recipient.phone,
          toName: recipient.name,
          message: recipient.message,
        });

        results.push({
          phone: recipient.phone,
          status: 'sent',
          notification_id: notificationId,
        });

        sent++;
      } catch (error: any) {
        results.push({
          phone: recipient.phone,
          status: 'failed',
          error: error.message,
        });

        failed++;
      }
    }

    return {
      total: recipients.length,
      sent,
      failed,
      results,
    };
  }

  /**
   * Get SMS delivery status from Twilio
   */
  async getDeliveryStatus(notificationId: string): Promise<string> {
    try {
      const notification = await this.prisma.smsNotification.findUnique({
        where: { id: notificationId },
      });

      if (!notification || !notification.providerMessageId) {
        return 'unknown';
      }

      if (!this.twilioClient) {
        return 'unknown';
      }

      const message = await this.twilioClient.messages(notification.providerMessageId).fetch();

      // Update local status
      await this.prisma.smsNotification.update({
        where: { id: notificationId },
        data: {
          providerStatus: message.status,
          status: ['delivered', 'sent'].includes(message.status)
            ? 'delivered'
            : ['failed', 'undelivered'].includes(message.status)
              ? 'failed'
              : notification.status,
          deliveredAt: message.status === 'delivered' ? new Date() : notification.deliveredAt,
        },
      });

      return message.status;
    } catch (error) {
      this.logger.error(`Failed to get delivery status for ${notificationId}:`, error);
      return 'unknown';
    }
  }

  /**
   * Retry failed SMS notifications
   */
  async retryFailedSMS(): Promise<{ retried: number; succeeded: number; failed: number }> {
    // Get failed notifications that haven't exceeded max retries
    const notifications = await this.prisma.smsNotification.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    let retried = 0;
    let succeeded = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        retried++;

        await this.sendSMS({
          to: notification.recipientPhone,
          toName: notification.recipientName || undefined,
          message: notification.message,
          documentType: notification.documentType || undefined,
          documentId: notification.documentId || undefined,
          notificationType: notification.notificationType,
        });

        succeeded++;

        // Mark original as retried
        await this.prisma.smsNotification.update({
          where: { id: notification.id },
          data: { retryCount: { increment: 1 } },
        });
      } catch (error) {
        failed++;

        // Increment retry count
        await this.prisma.smsNotification.update({
          where: { id: notification.id },
          data: { retryCount: { increment: 1 } },
        });
      }
    }

    return { retried, succeeded, failed };
  }

  /**
   * Get SMS notification history
   */
  async getSMSHistory(filters?: {
    recipient_phone?: string;
    status?: string;
    notification_type?: string;
    limit?: number;
  }) {
    return this.prisma.smsNotification.findMany({
      where: {
        ...(filters?.recipient_phone && { recipientPhone: filters.recipient_phone }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.notification_type && { notificationType: filters.notification_type }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }

  /**
   * Mark SMS as sent
   */
  private async markAsSent(notificationId: string, providerMessageId: string) {
    await this.prisma.smsNotification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId,
      },
    });
  }

  /**
   * Mark SMS as failed
   */
  private async markAsFailed(notificationId: string, reason: string) {
    await this.prisma.smsNotification.update({
      where: { id: notificationId },
      data: {
        status: 'failed',
        failedReason: reason,
        retryCount: { increment: 1 },
      },
    });
  }

  /**
   * Format phone number with country code
   */
  private formatPhoneNumber(phone: string): string {
    // Remove spaces, dashes, and parentheses
    let formatted = phone.replace(/[\s\-\(\)]/g, '');

    // If doesn't start with +, assume South Africa (+27)
    if (!formatted.startsWith('+')) {
      // Remove leading 0 if present
      if (formatted.startsWith('0')) {
        formatted = formatted.substring(1);
      }
      formatted = '+27' + formatted;
    }

    return formatted;
  }
}
