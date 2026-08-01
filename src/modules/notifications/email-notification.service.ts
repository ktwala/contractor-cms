import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  toName?: string;
  subject: string;
  body: string;
  html?: string;
  attachmentPath?: string;
  attachmentName?: string;
  documentType?: string;
  documentId?: string;
}

@Injectable()
export class EmailNotificationService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly prisma: PrismaService) {
    // Initialize email transporter
    // In production, use environment variables for credentials
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || 'noreply@payroll.com',
        pass: process.env.SMTP_PASS || 'password',
      },
    });
  }

  /**
   * Send IRP5 certificate via email
   */
  async sendIRP5Certificate(
    employeeId: string,
    irp5Id: string,
    pdfBuffer: Buffer,
    taxYear: string
  ): Promise<string> {
    // Get employee details
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, firstName: true, lastName: true, employeeNo: true },
    });

    if (!employee || !employee.email) {
      throw new Error('Employee email not found');
    }

    const emailOptions: EmailOptions = {
      to: employee.email,
      toName: `${employee.firstName} ${employee.lastName}`,
      subject: `Your IRP5 Tax Certificate for ${taxYear}`,
      body: this.getIRP5EmailTemplate(employee.firstName, employee.employeeNo, taxYear),
      html: this.getIRP5EmailHTML(employee.firstName, employee.employeeNo, taxYear),
      attachmentPath: `/tmp/irp5_${irp5Id}.pdf`, // Temporary path
      attachmentName: `IRP5_${employee.employeeNo}_${taxYear}.pdf`,
      documentType: 'irp5',
      documentId: irp5Id,
    };

    // Save PDF to temp location
    const fs = require('fs');
    fs.writeFileSync(emailOptions.attachmentPath!, pdfBuffer);

    return this.sendEmail('irp5_certificate', emailOptions);
  }

  /**
   * Send email notification
   */
  async sendEmail(notificationType: string, options: EmailOptions): Promise<string> {
    // Create notification record
    const notification = await this.prisma.emailNotification.create({
      data: {
        notificationType,
        recipientEmail: options.to,
        recipientName: options.toName,
        subject: options.subject,
        body: options.body,
        documentType: options.documentType,
        documentId: options.documentId,
        hasAttachment: !!options.attachmentPath,
        attachmentPath: options.attachmentPath,
        attachmentName: options.attachmentName,
        status: 'pending',
      },
    });

    try {
      // Send email
      const info = await this.transporter.sendMail({
        from: `"Payroll System" <${process.env.SMTP_FROM || 'noreply@payroll.com'}>`,
        to: options.to,
        subject: options.subject,
        text: options.body,
        html: options.html || options.body,
        attachments: options.attachmentPath ? [{
          filename: options.attachmentName || 'attachment',
          path: options.attachmentPath,
        }] : [],
      });

      // Update status to sent
      await this.markAsSent(notification.id, info.messageId);

      return notification.id;
    } catch (error: any) {
      // Update status to failed
      await this.markAsFailed(notification.id, error.message);
      throw error;
    }
  }

  /**
   * Bulk send IRP5 certificates.
   * Must receive allowedLegalEntityIds so fetch is scoped—never fetches unscoped.
   */
  async bulkSendIRP5Certificates(
    taxPeriodId: string,
    pdfGenerator: (irp5Id: string) => Promise<Buffer>,
    allowedLegalEntityIds: string[]
  ): Promise<{ total: number; sent: number; failed: number; results: any[] }> {
    if (allowedLegalEntityIds.length === 0) {
      return { total: 0, sent: 0, failed: 0, results: [] };
    }
    // Scope: only certificates in allowed legal entities
    const certificates = await this.prisma.iRP5Certificate.findMany({
      where: {
        taxPeriodId,
        status: { not: 'cancelled' },
        legalEntityId: { in: allowedLegalEntityIds },
      },
      include: {
        taxPeriod: true,
      },
    });

    const results: any[] = [];
    let sent = 0;
    let failed = 0;

    for (const cert of certificates) {
      try {
        // Generate PDF
        const pdfBuffer = await pdfGenerator(cert.id);

        // Send email
        const notificationId = await this.sendIRP5Certificate(
          cert.employeeId,
          cert.id,
          pdfBuffer,
          cert.taxPeriod.taxYear
        );

        results.push({
          irp5_id: cert.id,
          employee_number: cert.employeeNumber,
          status: 'sent',
          notification_id: notificationId,
        });

        sent++;
      } catch (error: any) {
        results.push({
          irp5_id: cert.id,
          employee_number: cert.employeeNumber,
          status: 'failed',
          error: error.message,
        });

        failed++;
      }
    }

    return {
      total: certificates.length,
      sent,
      failed,
      results,
    };
  }

  /**
   * Send payslip notification
   */
  async sendPayslipNotification(employeeId: string, payslipId: string, pdfBuffer: Buffer, month: string): Promise<string> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      select: { email: true, firstName: true, lastName: true },
    });

    if (!employee || !employee.email) {
      throw new Error('Employee email not found');
    }

    const emailOptions: EmailOptions = {
      to: employee.email,
      toName: `${employee.firstName} ${employee.lastName}`,
      subject: `Payslip for ${month}`,
      body: `Dear ${employee.firstName},\n\nPlease find attached your payslip for ${month}.\n\nBest regards,\nPayroll Team`,
      documentType: 'payslip',
      documentId: payslipId,
    };

    return this.sendEmail('payslip', emailOptions);
  }

  /**
   * Send reminder notification
   */
  async sendReminder(
    recipientEmail: string,
    recipientName: string,
    reminderType: string,
    subject: string,
    message: string
  ): Promise<string> {
    const emailOptions: EmailOptions = {
      to: recipientEmail,
      toName: recipientName,
      subject,
      body: message,
    };

    return this.sendEmail(reminderType, emailOptions);
  }

  /**
   * Mark notification as sent
   */
  private async markAsSent(notificationId: string, messageId: string) {
    await this.prisma.emailNotification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        sentAt: new Date(),
      },
    });
  }

  /**
   * Mark notification as failed
   */
  private async markAsFailed(notificationId: string, reason: string) {
    await this.prisma.emailNotification.update({
      where: { id: notificationId },
      data: {
        status: 'failed',
        failedReason: reason,
        retryCount: { increment: 1 },
      },
    });
  }

  /**
   * Retry failed notifications
   */
  async retryFailedNotifications(): Promise<{ retried: number; succeeded: number; failed: number }> {
    // Get failed notifications that haven't exceeded max retries
    const notifications = await this.prisma.emailNotification.findMany({
      where: {
        status: 'failed',
        retryCount: { lt: 3 }, // Use direct value since maxRetries is a column
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    let retried = 0;
    let succeeded = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        retried++;

        const emailOptions: EmailOptions = {
          to: notification.recipientEmail,
          toName: notification.recipientName || undefined,
          subject: notification.subject,
          body: notification.body,
          attachmentPath: notification.attachmentPath || undefined,
          attachmentName: notification.attachmentName || undefined,
          documentType: notification.documentType || undefined,
          documentId: notification.documentId || undefined,
        };

        await this.sendEmail(notification.notificationType, emailOptions);
        succeeded++;
      } catch (error) {
        failed++;
      }
    }

    return { retried, succeeded, failed };
  }

  /**
   * Get notification history
   */
  async getNotificationHistory(filters?: {
    notification_type?: string;
    recipient_email?: string;
    status?: string;
    document_type?: string;
    limit?: number;
  }) {
    return this.prisma.emailNotification.findMany({
      where: {
        ...(filters?.notification_type && { notificationType: filters.notification_type }),
        ...(filters?.recipient_email && { recipientEmail: filters.recipient_email }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.document_type && { documentType: filters.document_type }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }

  /**
   * IRP5 Email Template (Plain Text)
   */
  private getIRP5EmailTemplate(firstName: string, employeeNumber: string, taxYear: string): string {
    return `Dear ${firstName},

Your IRP5 Tax Certificate for the ${taxYear} tax year is now available.

Employee Number: ${employeeNumber}
Tax Year: ${taxYear}

Please find your IRP5 certificate attached to this email. This document is required for your annual tax return submission to SARS.

Important Notes:
- Keep this certificate for your records
- Use this certificate when filing your tax return
- If you notice any discrepancies, please contact HR immediately

If you have any questions, please don't hesitate to reach out to the payroll department.

Best regards,
Payroll Team`;
  }

  /**
   * IRP5 Email Template (HTML)
   */
  private getIRP5EmailHTML(firstName: string, employeeNumber: string, taxYear: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1976d2; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background: #f9f9f9; }
    .info-box { background: white; padding: 15px; margin: 15px 0; border-left: 4px solid #1976d2; }
    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
    .button { display: inline-block; padding: 10px 20px; background: #1976d2; color: white; text-decoration: none; border-radius: 5px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your IRP5 Tax Certificate</h1>
    </div>

    <div class="content">
      <p>Dear <strong>${firstName}</strong>,</p>

      <p>Your IRP5 Tax Certificate for the ${taxYear} tax year is now available.</p>

      <div class="info-box">
        <p><strong>Employee Number:</strong> ${employeeNumber}</p>
        <p><strong>Tax Year:</strong> ${taxYear}</p>
      </div>

      <p>Please find your IRP5 certificate attached to this email. This document is required for your annual tax return submission to SARS.</p>

      <h3>Important Notes:</h3>
      <ul>
        <li>Keep this certificate for your records</li>
        <li>Use this certificate when filing your tax return</li>
        <li>If you notice any discrepancies, please contact HR immediately</li>
      </ul>

      <p>If you have any questions, please don't hesitate to reach out to the payroll department.</p>
    </div>

    <div class="footer">
      <p>Best regards,<br><strong>Payroll Team</strong></p>
      <p style="margin-top: 20px; font-size: 11px;">This is an automated message. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}
