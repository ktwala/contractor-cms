import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  Headers,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MobileAuthService, AuthTokens } from './mobile-auth.service';
import { PushNotificationService } from './push-notification.service';

interface RegisterDeviceDto {
  deviceType: 'ios' | 'android';
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
}

interface RefreshTokenDto {
  refreshToken: string;
}

interface UpdatePushTokenDto {
  pushToken: string;
  pushProvider?: 'fcm' | 'apns';
}

@ApiTags('Mobile - Authentication')
@Controller('api/mobile/auth')
export class MobileAuthController {
  constructor(
    private readonly mobileAuthService: MobileAuthService,
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * Register mobile device
   * Called after user logs in via standard auth
   */
  @Post('device/register')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Register mobile device' })
  async registerDevice(
    @Request() req: any,
    @Body() deviceData: RegisterDeviceDto,
    @Headers('x-forwarded-for') ip?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthTokens> {
    const userId = req.user.userId;

    const tokens = await this.mobileAuthService.registerDevice(
      userId,
      deviceData,
      ip || req.ip,
      userAgent,
    );

    return tokens;
  }

  /**
   * Refresh access token
   */
  @Post('token/refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() body: RefreshTokenDto): Promise<AuthTokens> {
    const tokens = await this.mobileAuthService.refreshAccessToken(
      body.refreshToken,
    );

    return tokens;
  }

  /**
   * Update push notification token
   */
  @Post('device/push-token')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Update push notification token' })
  async updatePushToken(@Request() req: any, @Body() body: UpdatePushTokenDto) {
    const deviceId = req.user.deviceId;

    await this.mobileAuthService.updatePushToken(
      deviceId,
      body.pushToken,
      body.pushProvider || 'fcm',
    );

    return { success: true };
  }

  /**
   * Test push notification
   */
  @Post('device/test-push')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Send test push notification' })
  async testPushNotification(@Request() req: any) {
    const userId = req.user.userId;

    await this.pushNotificationService.sendPushNotification({
      userId,
      title: 'Test Notification',
      body: 'This is a test push notification from the payroll system',
      notificationType: 'test',
      priority: 'high',
    });

    return { success: true };
  }

  /**
   * Subscribe to topic
   */
  @Post('device/topics/:topic/subscribe')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Subscribe device to topic' })
  async subscribeToTopic(
    @Request() req: any,
    @Param('topic') topic: string,
  ) {
    const deviceId = req.user.deviceId;

    await this.pushNotificationService.subscribeToTopic(deviceId, topic);

    return { success: true };
  }

  /**
   * Unsubscribe from topic
   */
  @Post('device/topics/:topic/unsubscribe')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Unsubscribe device from topic' })
  async unsubscribeFromTopic(
    @Request() req: any,
    @Param('topic') topic: string,
  ) {
    const deviceId = req.user.deviceId;

    await this.pushNotificationService.unsubscribeFromTopic(deviceId, topic);

    return { success: true };
  }

  /**
   * Get active devices
   */
  @Get('devices')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Get active devices' })
  async getActiveDevices(@Request() req: any) {
    const userId = req.user.userId;

    const devices = await this.mobileAuthService.getActiveDevices(userId);

    return devices;
  }

  /**
   * Deactivate device
   */
  @Delete('devices/:device_id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Deactivate device' })
  async deactivateDevice(
    @Request() req: any,
    @Param('device_id') deviceId: string,
  ) {
    const userId = req.user.userId;

    await this.mobileAuthService.deactivateDevice(userId, deviceId);

    return { success: true };
  }

  /**
   * Logout from current device
   */
  @Post('logout')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Logout from current device' })
  async logout(@Request() req: any) {
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;

    await this.mobileAuthService.logout(userId, deviceId);

    return { success: true };
  }

  /**
   * Logout from all devices
   */
  @Post('logout-all')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth('bearerAuth')
  @ApiOperation({ summary: 'Logout from all devices' })
  async logoutAll(@Request() req: any) {
    const userId = req.user.userId;

    await this.mobileAuthService.logoutAllDevices(userId);

    return { success: true };
  }
}
