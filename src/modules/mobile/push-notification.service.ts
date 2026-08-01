import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../core/database/prisma.service';
import * as admin from 'firebase-admin';

interface PushNotificationOptions {
  userId: string;
  deviceId?: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  notificationType: string;
  priority?: 'high' | 'normal' | 'low';
  scheduledFor?: Date;
}

interface DeviceInfo {
  id: string;
  pushToken: string;
  pushProvider: string;
  deviceType: string;
}

@Injectable()
export class PushNotificationService {
  private readonly logger = new Logger(PushNotificationService.name);
  private fcmInitialized = false;

  constructor(private readonly prisma: PrismaService) {
    this.initializeFirebase();
  }

  /**
   * Initialize Firebase Admin SDK
   */
  private initializeFirebase() {
    try {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

      if (!serviceAccount) {
        this.logger.warn(
          'Firebase service account not configured. Push notifications will be disabled.',
        );
        return;
      }

      // Initialize Firebase Admin
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(require(serviceAccount)),
        });
      }

      this.fcmInitialized = true;
      this.logger.log('Firebase Admin SDK initialized successfully');
    } catch (error: any) {
      this.logger.error('Failed to initialize Firebase Admin SDK:', error);
    }
  }

  /**
   * Send push notification to user
   */
  async sendPushNotification(
    options: PushNotificationOptions,
  ): Promise<string[]> {
    const notificationIds: string[] = [];

    try {
      // Get user's active devices
      const devices = await this.getUserDevices(
        options.userId,
        options.deviceId,
      );

      if (devices.length === 0) {
        this.logger.warn(`No active devices found for user ${options.userId}`);
        return [];
      }

      // Create notification record for each device
      for (const device of devices) {
        const notification = await this.createPushNotificationRecord(
          options,
          device,
        );
        notificationIds.push(notification.id);

        // Send immediately if not scheduled
        if (!options.scheduledFor) {
          await this.sendToDevice(notification.id, device, options);
        }
      }

      return notificationIds;
    } catch (error: any) {
      this.logger.error('Failed to send push notification:', error);
      throw error;
    }
  }

  /**
   * Send push notification to specific device
   */
  private async sendToDevice(
    notificationId: string,
    device: DeviceInfo,
    options: PushNotificationOptions,
  ) {
    try {
      if (!this.fcmInitialized) {
        throw new Error('Firebase is not initialized');
      }

      if (!device.pushToken) {
        throw new Error('Device has no push token');
      }

      // Build notification payload
      const message: admin.messaging.Message = {
        token: device.pushToken,
        notification: {
          title: options.title,
          body: options.body,
        },
        data: {
          notification_id: notificationId,
          type: options.notificationType,
          ...(options.data || {}),
        },
        android: {
          priority: options.priority === 'high' ? 'high' : 'normal',
          notification: {
            channelId: 'payroll_notifications',
            priority:
              options.priority === 'high'
                ? 'high'
                : options.priority === 'low'
                  ? 'low'
                  : 'default',
          },
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: options.title,
                body: options.body,
              },
              badge: 1,
              sound: 'default',
              contentAvailable: true,
            },
          },
        },
      };

      // Send via FCM
      const response = await admin.messaging().send(message);

      // Update notification status
      await this.markAsSent(notificationId, response);

      this.logger.log(
        `Push notification sent successfully to device ${device.id}`,
      );
    } catch (error: any) {
      await this.markAsFailed(notificationId, error.message);
      this.logger.error(
        `Failed to send push to device ${device.id}:`,
        error,
      );

      // If token is invalid, deactivate the device
      if (
        error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered'
      ) {
        await this.deactivateDevice(device.id);
      }
    }
  }

  /**
   * Send bulk push notifications
   */
  async sendBulkPush(
    userIds: string[],
    title: string,
    body: string,
    data?: Record<string, any>,
    notificationType = 'bulk_announcement',
  ): Promise<{ total: number; sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const userId of userIds) {
      try {
        await this.sendPushNotification({
          userId,
          title,
          body,
          data,
          notificationType,
          priority: 'normal',
        });
        sent++;
      } catch (error) {
        failed++;
      }
    }

    return {
      total: userIds.length,
      sent,
      failed,
    };
  }

  /**
   * Send notification to specific topic
   */
  async sendToTopic(
    topic: string,
    title: string,
    body: string,
    data?: Record<string, any>,
  ): Promise<string> {
    try {
      if (!this.fcmInitialized) {
        throw new Error('Firebase is not initialized');
      }

      const message: admin.messaging.Message = {
        topic,
        notification: {
          title,
          body,
        },
        data: data || {},
        android: {
          priority: 'high',
        },
      };

      const response = await admin.messaging().send(message);
      this.logger.log(`Message sent to topic ${topic}: ${response}`);

      return response;
    } catch (error: any) {
      this.logger.error(`Failed to send to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe device to topic
   */
  async subscribeToTopic(
    deviceId: string,
    topic: string,
  ): Promise<void> {
    try {
      const device = await this.prisma.mobileDevice.findFirst({
        where: { id: deviceId, isActive: true },
      });

      if (!device || !device.pushToken) {
        throw new Error('Device not found or has no push token');
      }

      if (!this.fcmInitialized) {
        throw new Error('Firebase is not initialized');
      }

      await admin
        .messaging()
        .subscribeToTopic([device.pushToken], topic);

      this.logger.log(`Device ${deviceId} subscribed to topic ${topic}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to subscribe device ${deviceId} to topic ${topic}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Unsubscribe device from topic
   */
  async unsubscribeFromTopic(
    deviceId: string,
    topic: string,
  ): Promise<void> {
    try {
      const device = await this.prisma.mobileDevice.findFirst({
        where: { id: deviceId, isActive: true },
      });

      if (!device || !device.pushToken) {
        throw new Error('Device not found or has no push token');
      }

      if (!this.fcmInitialized) {
        throw new Error('Firebase is not initialized');
      }

      await admin
        .messaging()
        .unsubscribeFromTopic([device.pushToken], topic);

      this.logger.log(`Device ${deviceId} unsubscribed from topic ${topic}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to unsubscribe device ${deviceId} from topic ${topic}:`,
        error,
      );
      throw error;
    }
  }

  /**
   * Process scheduled push notifications
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processScheduledPushNotifications() {
    try {
      const notifications = await this.prisma.pushNotification.findMany({
        where: {
          status: 'pending',
          scheduledFor: { not: null, lte: new Date() },
        },
        include: {
          device: true,
        },
        take: 100,
      });

      this.logger.log(
        `Processing ${notifications.length} scheduled push notifications`,
      );

      for (const notification of notifications) {
        if (!notification.device.isActive) continue;

        const device: DeviceInfo = {
          id: notification.deviceId,
          pushToken: notification.device.pushToken || '',
          pushProvider: notification.device.pushProvider || 'fcm',
          deviceType: notification.device.deviceType,
        };

        const options: PushNotificationOptions = {
          userId: notification.userId,
          deviceId: notification.deviceId,
          title: notification.title,
          body: notification.body,
          data: notification.data as Record<string, any> || undefined,
          notificationType: notification.notificationType,
          priority: notification.priority as 'high' | 'normal' | 'low',
        };

        await this.sendToDevice(notification.id, device, options);
      }
    } catch (error) {
      this.logger.error('Failed to process scheduled notifications:', error);
    }
  }

  /**
   * Retry failed push notifications
   * Runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async retryFailedPushNotifications() {
    try {
      const notifications = await this.prisma.pushNotification.findMany({
        where: {
          status: 'failed',
          retryCount: { lt: 3 },
        },
        include: {
          device: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      this.logger.log(`Retrying ${notifications.length} failed push notifications`);

      for (const notification of notifications) {
        if (!notification.device.isActive) continue;

        const device: DeviceInfo = {
          id: notification.deviceId,
          pushToken: notification.device.pushToken || '',
          pushProvider: notification.device.pushProvider || 'fcm',
          deviceType: notification.device.deviceType,
        };

        const options: PushNotificationOptions = {
          userId: notification.userId,
          deviceId: notification.deviceId,
          title: notification.title,
          body: notification.body,
          data: notification.data as Record<string, any> || undefined,
          notificationType: notification.notificationType,
          priority: notification.priority as 'high' | 'normal' | 'low',
        };

        // Increment retry count
        await this.prisma.pushNotification.update({
          where: { id: notification.id },
          data: { retryCount: { increment: 1 } },
        });

        await this.sendToDevice(notification.id, device, options);
      }
    } catch (error) {
      this.logger.error('Failed to retry push notifications:', error);
    }
  }

  /**
   * Clean up old push notification records
   * Runs daily at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanupOldPushNotifications() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      // Delete sent notifications older than 30 days
      const sentResult = await this.prisma.pushNotification.deleteMany({
        where: {
          status: 'sent',
          sentAt: { lt: thirtyDaysAgo },
        },
      });

      // Delete delivered notifications older than 90 days
      const deliveredResult = await this.prisma.pushNotification.deleteMany({
        where: {
          status: 'delivered',
          deliveredAt: { lt: ninetyDaysAgo },
        },
      });

      this.logger.log(
        `Cleaned up old push notifications: ${sentResult.count + deliveredResult.count} records deleted`,
      );
    } catch (error) {
      this.logger.error('Failed to cleanup push notifications:', error);
    }
  }

  /**
   * Get user's active devices
   */
  private async getUserDevices(
    userId: string,
    deviceId?: string,
  ): Promise<DeviceInfo[]> {
    const devices = await this.prisma.mobileDevice.findMany({
      where: {
        userId,
        isActive: true,
        pushToken: { not: null },
        ...(deviceId && { id: deviceId }),
      },
    });

    return devices.map(d => ({
      id: d.id,
      pushToken: d.pushToken || '',
      pushProvider: d.pushProvider || 'fcm',
      deviceType: d.deviceType,
    }));
  }

  /**
   * Create push notification record
   */
  private async createPushNotificationRecord(
    options: PushNotificationOptions,
    device: DeviceInfo,
  ) {
    return this.prisma.pushNotification.create({
      data: {
        userId: options.userId,
        deviceId: device.id,
        notificationType: options.notificationType,
        title: options.title,
        body: options.body,
        data: options.data || {},
        priority: options.priority || 'normal',
        provider: device.pushProvider,
        scheduledFor: options.scheduledFor,
        status: 'pending',
      },
    });
  }

  /**
   * Mark notification as sent
   */
  private async markAsSent(
    notificationId: string,
    providerMessageId: string,
  ) {
    await this.prisma.pushNotification.update({
      where: { id: notificationId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        providerMessageId,
      },
    });
  }

  /**
   * Mark notification as failed
   */
  private async markAsFailed(notificationId: string, reason: string) {
    await this.prisma.pushNotification.update({
      where: { id: notificationId },
      data: {
        status: 'failed',
        failedReason: reason,
      },
    });
  }

  /**
   * Deactivate device (invalid token)
   */
  private async deactivateDevice(deviceId: string) {
    await this.prisma.mobileDevice.update({
      where: { id: deviceId },
      data: { isActive: false },
    });
    this.logger.log(`Device ${deviceId} deactivated due to invalid token`);
  }

  /**
   * Get push notification history
   */
  async getPushHistory(filters?: {
    userId?: string;
    deviceId?: string;
    status?: string;
    notificationType?: string;
    limit?: number;
  }) {
    return this.prisma.pushNotification.findMany({
      where: {
        ...(filters?.userId && { userId: filters.userId }),
        ...(filters?.deviceId && { deviceId: filters.deviceId }),
        ...(filters?.status && { status: filters.status }),
        ...(filters?.notificationType && { notificationType: filters.notificationType }),
      },
      orderBy: { createdAt: 'desc' },
      take: filters?.limit || 100,
    });
  }
}
