import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowNotificationService } from './workflow-notification.service';
import { SmsNotificationService } from './sms-notification.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { PrismaService } from '../../core/database/prisma.service';

@ApiTags('Notifications')
@ApiBearerAuth('bearerAuth')
@Controller('api/notifications')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class NotificationsController {
  constructor(
    private readonly workflowService: WorkflowNotificationService,
    private readonly smsService: SmsNotificationService,
    private readonly prisma: PrismaService,
  ) { }

  @Get('in-app/:user_id')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get in-app notifications for user' })
  async getInAppNotifications(
    @Param('user_id') userId: string,
    @Query('unread_only') unreadOnly?: boolean,
  ) {
    const isUnreadOnly = unreadOnly === true || String(unreadOnly) === 'true' || String(unreadOnly) === '1';

    return (this.prisma as any).inAppNotification.findMany({
      where: {
        userId,
        isArchived: false,
        ...(isUnreadOnly && { isRead: false }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  @Get('stats/:user_id')
  @Permissions('notifications:read')
  @ApiOperation({ summary: 'Get notification statistics' })
  async getNotificationStats(@Param('user_id') userId: string) {
    const [total, unread] = await Promise.all([
      (this.prisma as any).inAppNotification.count({ where: { userId, isArchived: false } }),
      (this.prisma as any).inAppNotification.count({ where: { userId, isArchived: false, isRead: false } }),
    ]);

    return { in_app: { total, unread } };
  }
}
