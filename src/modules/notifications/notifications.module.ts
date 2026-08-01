import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { EmailNotificationService } from './email-notification.service';
import { NotificationSchedulerService } from './notification-scheduler.service';
import { WorkflowNotificationService } from './workflow-notification.service';
import { SmsNotificationService } from './sms-notification.service';

@Module({
  controllers: [NotificationsController],
  providers: [
    EmailNotificationService,
    NotificationSchedulerService,
    WorkflowNotificationService,
    SmsNotificationService,
  ],
  exports: [
    EmailNotificationService,
    NotificationSchedulerService,
    WorkflowNotificationService,
    SmsNotificationService,
  ],
})
export class NotificationsModule {}
