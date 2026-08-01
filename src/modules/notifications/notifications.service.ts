import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  NotificationType,
  DeliveryChannel,
  NotificationStatus,
  NotificationPriority,
  SendNotificationDto,
  NotificationResponseDto,
  NotificationListResponseDto,
  ListNotificationsDto,
  CreateWebhookDto,
  UpdateWebhookDto,
  WebhookResponseDto,
  UpdatePreferencesDto,
  PreferencesResponseDto,
  NOTIFICATION_TEMPLATES,
} from './dto/notification.dto';
import * as crypto from 'crypto';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // Send Notifications
  // ============================================================================

  async send(dto: SendNotificationDto): Promise<NotificationResponseDto[]> {
    const template = NOTIFICATION_TEMPLATES[dto.type];
    if (!template) {
      throw new BadRequestException(`Unknown notification type: ${dto.type}`);
    }

    // Resolve target users
    const userIds = await this.resolveTargetUsers(dto);
    if (userIds.length === 0) {
      this.logger.warn(`No target users found for notification: ${dto.type}`);
      return [];
    }

    const notifications: NotificationResponseDto[] = [];
    const priority = dto.priority || NotificationPriority.NORMAL;

    for (const userId of userIds) {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId);
      const typePreference = preferences.find((p) => p.type === dto.type);

      // Skip if user has disabled this notification type
      if (typePreference && !typePreference.enabled) {
        continue;
      }

      // Determine which channels to use
      const channels = dto.channels || this.getDefaultChannels(dto.type, typePreference);

      for (const channel of channels) {
        // Check channel preference
        if (typePreference) {
          const channelPref = typePreference.channels?.find((c: any) => c.channel === channel);
          if (channelPref && !channelPref.enabled) {
            continue;
          }
        }

        try {
          const notification = await this.createNotification(
            userId,
            dto.type,
            template,
            dto.data,
            channel,
            priority,
          );

          // Dispatch based on channel
          await this.dispatch(notification, channel, dto.data);

          notifications.push(this.mapToResponse(notification));
        } catch (error) {
          this.logger.error(`Failed to send ${channel} notification to user ${userId}:`, error);
        }
      }
    }

    // Also send to webhooks
    await this.dispatchToWebhooks(dto.type, dto.data, dto.legal_entity_id);

    return notifications;
  }

  async sendDirect(
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
    channel: DeliveryChannel = DeliveryChannel.IN_APP,
  ): Promise<NotificationResponseDto> {
    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) {
      throw new BadRequestException(`Unknown notification type: ${type}`);
    }

    const notification = await this.createNotification(
      userId,
      type,
      template,
      data,
      channel,
      NotificationPriority.NORMAL,
    );

    await this.dispatch(notification, channel, data);

    return this.mapToResponse(notification);
  }

  // ============================================================================
  // Notification CRUD
  // ============================================================================

  async list(userId: string, query: ListNotificationsDto): Promise<NotificationListResponseDto> {
    const where: any = { userId };

    if (query.status) {
      where.status = query.status;
    }
    if (query.type) {
      where.type = query.type;
    }
    if (query.unread_only) {
      where.readAt = null;
    }
    if (query.from_date) {
      where.createdAt = { gte: new Date(query.from_date) };
    }
    if (query.to_date) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.to_date) };
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: query.limit || 50,
        skip: query.offset || 0,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({ where: { userId, readAt: null } }),
    ]);

    return {
      notifications: notifications.map((n: any) => this.mapToResponse(n)),
      total,
      unread_count: unreadCount,
    };
  }

  async findOne(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    return this.mapToResponse(notification);
  }

  async markAsRead(id: string, userId: string): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });

    return this.mapToResponse(updated);
  }

  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date(), status: NotificationStatus.READ },
    });

    return { count: result.count };
  }

  async delete(id: string, userId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new NotFoundException(`Notification ${id} not found`);
    }

    await this.prisma.notification.delete({ where: { id } });
  }

  // ============================================================================
  // User Preferences
  // ============================================================================

  async getPreferences(userId: string): Promise<PreferencesResponseDto> {
    const preferences = await this.getUserPreferences(userId);

    // Return default preferences if none exist
    if (preferences.length === 0) {
      return {
        user_id: userId,
        preferences: this.getDefaultPreferences(),
        updated_at: new Date().toISOString(),
      };
    }

    return {
      user_id: userId,
      preferences,
      updated_at: new Date().toISOString(),
    };
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<PreferencesResponseDto> {
    // Upsert preferences
    await this.prisma.notificationPreference.deleteMany({ where: { userId } });

    for (const pref of dto.preferences) {
      await this.prisma.notificationPreference.create({
        data: {
          userId,
          type: pref.type,
          enabled: pref.enabled,
          channels: pref.channels as any,
        },
      });
    }

    return this.getPreferences(userId);
  }

  // ============================================================================
  // Webhook Management
  // ============================================================================

  async createWebhook(dto: CreateWebhookDto, legalEntityId?: string): Promise<WebhookResponseDto> {
    const secret = dto.secret || this.generateWebhookSecret();

    const webhook = await this.prisma.webhook.create({
      data: {
        name: dto.name,
        description: dto.description,
        url: dto.url,
        secret,
        events: dto.events || Object.values(NotificationType),
        active: dto.active ?? true,
        headers: dto.headers || {},
        legalEntityId,
      },
    });

    return this.mapWebhookToResponse(webhook);
  }

  async listWebhooks(legalEntityId?: string): Promise<WebhookResponseDto[]> {
    const where: any = {};
    if (legalEntityId) {
      where.legalEntityId = legalEntityId;
    }

    const webhooks = await this.prisma.webhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return webhooks.map((w: any) => this.mapWebhookToResponse(w));
  }

  async getWebhook(id: string): Promise<WebhookResponseDto> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    return this.mapWebhookToResponse(webhook);
  }

  async updateWebhook(id: string, dto: UpdateWebhookDto): Promise<WebhookResponseDto> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    const updated = await this.prisma.webhook.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        url: dto.url,
        secret: dto.secret,
        events: dto.events,
        active: dto.active,
      },
    });

    return this.mapWebhookToResponse(updated);
  }

  async deleteWebhook(id: string): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    await this.prisma.webhook.delete({ where: { id } });
  }

  async testWebhook(id: string): Promise<{ success: boolean; response?: any; error?: string }> {
    const webhook = await this.prisma.webhook.findUnique({ where: { id } });

    if (!webhook) {
      throw new NotFoundException(`Webhook ${id} not found`);
    }

    try {
      const testPayload = {
        event: 'webhook.test',
        webhook_id: id,
        timestamp: new Date().toISOString(),
        message: 'This is a test webhook delivery',
      };

      const result = await this.deliverWebhook(webhook as any, testPayload);
      return { success: true, response: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // Payroll Event Helpers
  // ============================================================================

  async notifyPayrunCreated(payrunId: string, payrun: any): Promise<void> {
    await this.send({
      type: NotificationType.PAYRUN_CREATED,
      legal_entity_id: payrun.payGroup?.legalEntityId,
      pay_group_id: payrun.payGroupId,
      data: {
        payrun_id: payrunId,
        pay_group_id: payrun.payGroupId,
        pay_group_name: payrun.payGroup?.name,
        period_start: payrun.periodStart,
        period_end: payrun.periodEnd,
        pay_date: payrun.payDate,
        employee_count: payrun.payRunEmployees?.length || 0,
        payrun_url: `/payruns/${payrunId}`,
      },
    });
  }

  async notifyPayrunCalculated(payrunId: string, payrun: any, totals: any): Promise<void> {
    await this.send({
      type: NotificationType.PAYRUN_CALCULATED,
      legal_entity_id: payrun.payGroup?.legalEntityId,
      pay_group_id: payrun.payGroupId,
      data: {
        payrun_id: payrunId,
        pay_group_name: payrun.payGroup?.name,
        total_gross: totals.totalGross,
        total_net: totals.totalNet,
        employee_count: totals.employeeCount,
        currency: payrun.payGroup?.currency || 'ZAR',
        payrun_url: `/payruns/${payrunId}`,
      },
    });
  }

  async notifyApprovalRequired(
    approverUserId: string,
    entityType: string,
    entityId: string,
    description: string,
    submitterName: string,
  ): Promise<void> {
    await this.sendDirect(approverUserId, NotificationType.APPROVAL_REQUIRED, {
      entity_type: entityType,
      entity_id: entityId,
      description,
      submitter_name: submitterName,
      submitted_at: new Date().toISOString(),
      approval_url: `/approvals/${entityId}`,
    });
  }

  async notifyPayrunApproved(payrunId: string, payrun: any, approverName: string, level: number): Promise<void> {
    await this.send({
      type: NotificationType.PAYRUN_APPROVED,
      legal_entity_id: payrun.payGroup?.legalEntityId,
      pay_group_id: payrun.payGroupId,
      data: {
        payrun_id: payrunId,
        pay_group_name: payrun.payGroup?.name,
        approver_name: approverName,
        approval_level: level,
        payrun_url: `/payruns/${payrunId}`,
      },
    });
  }

  async notifyPayrunRejected(
    payrunId: string,
    payrun: any,
    rejectorName: string,
    reason: string,
  ): Promise<void> {
    await this.send({
      type: NotificationType.PAYRUN_REJECTED,
      legal_entity_id: payrun.payGroup?.legalEntityId,
      pay_group_id: payrun.payGroupId,
      data: {
        payrun_id: payrunId,
        pay_group_name: payrun.payGroup?.name,
        rejector_name: rejectorName,
        rejection_reason: reason,
        payrun_url: `/payruns/${payrunId}`,
      },
    });
  }

  async notifyPayDateReminder(payGroupId: string, payDate: Date, daysUntil: number): Promise<void> {
    const payGroup = await this.prisma.payGroup.findUnique({ where: { id: payGroupId } });
    if (!payGroup) return;

    await this.send({
      type: NotificationType.PAY_DATE_REMINDER,
      pay_group_id: payGroupId,
      legal_entity_id: (payGroup as any).legalEntityId,
      data: {
        pay_group_id: payGroupId,
        pay_group_name: (payGroup as any).name,
        pay_date: payDate.toISOString().split('T')[0],
        days_until: daysUntil,
      },
      priority: daysUntil <= 1 ? NotificationPriority.HIGH : NotificationPriority.NORMAL,
    });
  }

  // ============================================================================
  // Private Helpers
  // ============================================================================

  private async resolveTargetUsers(dto: SendNotificationDto): Promise<string[]> {
    const userIds: Set<string> = new Set();

    // Direct user IDs
    if (dto.user_id) {
      userIds.add(dto.user_id);
    }
    if (dto.user_ids) {
      dto.user_ids.forEach((id) => userIds.add(id));
    }

    // If no direct users, resolve based on entity
    if (userIds.size === 0 && (dto.legal_entity_id || dto.pay_group_id)) {
      // Get users associated with legal entity or pay group
      const users = await this.prisma.user.findMany({
        where: {
          userRoles: {
            some: {
              role: {
                permissions: {
                  some: {
                    permission: {
                      code: { in: ['payrun:read', 'payrun:approve'] },
                    },
                  },
                },
              },
            },
          },
        },
        select: { id: true },
      });
      users.forEach((u: any) => userIds.add(u.id));
    }

    return Array.from(userIds);
  }

  private async getUserPreferences(userId: string): Promise<any[]> {
    const preferences = await this.prisma.notificationPreference.findMany({
      where: { userId },
    });
    return preferences;
  }

  private getDefaultChannels(type: NotificationType, preference?: any): DeliveryChannel[] {
    // Default channels based on notification type
    const urgentTypes = [
      NotificationType.APPROVAL_REQUIRED,
      NotificationType.PAYRUN_REJECTED,
      NotificationType.PAY_DATE_REMINDER,
    ];

    if (urgentTypes.includes(type)) {
      return [DeliveryChannel.EMAIL, DeliveryChannel.IN_APP];
    }

    return [DeliveryChannel.IN_APP];
  }

  private getDefaultPreferences(): any[] {
    return Object.values(NotificationType).map((type) => ({
      type,
      enabled: true,
      channels: [
        { channel: DeliveryChannel.IN_APP, enabled: true },
        { channel: DeliveryChannel.EMAIL, enabled: type.includes('APPROVAL') || type.includes('REJECTED') },
        { channel: DeliveryChannel.WEBHOOK, enabled: true },
      ],
    }));
  }

  private async createNotification(
    userId: string,
    type: NotificationType,
    template: any,
    data: Record<string, any>,
    channel: DeliveryChannel,
    priority: NotificationPriority,
  ): Promise<any> {
    const title = this.interpolate(template.title, data);
    const message = this.interpolate(template.inAppMessage, data);

    return this.prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        data,
        channel,
        priority,
        status: NotificationStatus.PENDING,
      },
    });
  }

  private async dispatch(notification: any, channel: DeliveryChannel, data: Record<string, any>): Promise<void> {
    try {
      switch (channel) {
        case DeliveryChannel.EMAIL:
          await this.sendEmail(notification, data);
          break;
        case DeliveryChannel.IN_APP:
          // In-app notifications are already stored
          break;
        case DeliveryChannel.WEBHOOK:
          // Webhooks are handled separately
          break;
        case DeliveryChannel.SMS:
          await this.sendSms(notification, data);
          break;
      }

      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.SENT, sentAt: new Date() },
      });
    } catch (error) {
      await this.prisma.notification.update({
        where: { id: notification.id },
        data: { status: NotificationStatus.FAILED },
      });
      throw error;
    }
  }

  private async sendEmail(notification: any, data: Record<string, any>): Promise<void> {
    const template = NOTIFICATION_TEMPLATES[notification.type as NotificationType];
    if (!template) return;

    const subject = this.interpolate(template.emailSubject, data);
    const body = this.interpolate(template.emailBody, data);

    // Get user email
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      select: { email: true },
    });

    if (!user?.email) {
      this.logger.warn(`No email found for user ${notification.userId}`);
      return;
    }

    // In production, integrate with email service (SendGrid, AWS SES, etc.)
    this.logger.log(`[EMAIL] To: ${user.email}, Subject: ${subject}`);
    this.logger.debug(`[EMAIL] Body: ${body}`);

    // TODO: Implement actual email sending
    // await this.emailService.send({
    //   to: user.email,
    //   subject,
    //   html: body,
    // });
  }

  private async sendSms(notification: any, data: Record<string, any>): Promise<void> {
    // Get user phone
    const user = await this.prisma.user.findUnique({
      where: { id: notification.userId },
      select: { phone: true },
    });

    if (!user?.phone) {
      this.logger.warn(`No phone number found for user ${notification.userId}`);
      return;
    }

    this.logger.log(`[SMS] To: ${user.phone}, Message: ${notification.message}`);

    // TODO: Implement actual SMS sending (Twilio, etc.)
  }

  private async dispatchToWebhooks(
    type: NotificationType,
    data: Record<string, any>,
    legalEntityId?: string,
  ): Promise<void> {
    const where: any = {
      active: true,
      events: { has: type },
    };

    if (legalEntityId) {
      where.OR = [{ legalEntityId }, { legalEntityId: null }];
    }

    const webhooks = await this.prisma.webhook.findMany({ where });

    const template = NOTIFICATION_TEMPLATES[type];
    if (!template) return;

    const payload = template.webhookPayload(data);

    for (const webhook of webhooks) {
      try {
        await this.deliverWebhook(webhook as any, payload);
        await this.prisma.webhook.update({
          where: { id: (webhook as any).id },
          data: { lastTriggeredAt: new Date() },
        });
      } catch (error) {
        this.logger.error(`Failed to deliver webhook ${(webhook as any).id}:`, error);
      }
    }
  }

  private async deliverWebhook(webhook: any, payload: Record<string, any>): Promise<any> {
    const body = JSON.stringify(payload);
    const signature = this.signWebhookPayload(body, webhook.secret);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
      'X-Webhook-Id': webhook.id,
      ...webhook.headers,
    };

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers,
      body,
    });

    if (!response.ok) {
      throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
    }

    return response.json().catch(() => ({}));
  }

  private signWebhookPayload(payload: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  private generateWebhookSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private interpolate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? String(data[key]) : match;
    });
  }

  private mapToResponse(notification: any): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      status: notification.status,
      priority: notification.priority,
      channel: notification.channel,
      user_id: notification.userId,
      read_at: notification.readAt?.toISOString(),
      sent_at: notification.sentAt?.toISOString(),
      created_at: notification.createdAt.toISOString(),
    };
  }

  private mapWebhookToResponse(webhook: any): WebhookResponseDto {
    return {
      id: webhook.id,
      name: webhook.name,
      description: webhook.description,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      created_at: webhook.createdAt.toISOString(),
      last_triggered_at: webhook.lastTriggeredAt?.toISOString(),
    };
  }
}
