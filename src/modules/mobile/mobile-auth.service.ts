import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../core/database/prisma.service';
import * as crypto from 'crypto';

interface DeviceRegistration {
  deviceType: 'ios' | 'android';
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  pushToken?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  deviceId: string;
}

interface RefreshTokenPayload {
  userId: string;
  deviceId: string;
  sessionId: string;
}

@Injectable()
export class MobileAuthService {
  private readonly logger = new Logger(MobileAuthService.name);
  private readonly ACCESS_TOKEN_EXPIRY = '15m';
  private readonly REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60 * 1000;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) { }

  async registerDevice(userId: string, registration: DeviceRegistration, ipAddress?: string, userAgent?: string): Promise<AuthTokens> {
    try {
      const deviceId = await this.findOrCreateDevice(userId, registration);
      await this.updateDeviceInfo(deviceId, registration);
      const sessionId = await this.createSession(userId, deviceId, ipAddress, userAgent);
      const tokens = await this.generateTokens(userId, deviceId, sessionId);

      this.logger.log(`Device registered for user ${userId}: ${deviceId}`);
      return { ...tokens, deviceId };
    } catch (error: any) {
      this.logger.error('Failed to register device:', error);
      throw error;
    }
  }

  async refreshAccessToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = await this.verifyRefreshToken(refreshToken);
      const session = await this.getActiveSession(payload.sessionId, refreshToken);

      if (!session) throw new UnauthorizedException('Invalid or expired refresh token');

      await this.updateSessionLastUsed(payload.sessionId);
      const tokens = await this.generateTokens(payload.userId, payload.deviceId, payload.sessionId);
      await this.updateSessionAccessToken(payload.sessionId, tokens.accessToken);

      this.logger.log(`Access token refreshed for user ${payload.userId}`);
      return { ...tokens, deviceId: payload.deviceId };
    } catch (error: any) {
      this.logger.error('Failed to refresh token:', error);
      throw new UnauthorizedException('Failed to refresh token');
    }
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    await (this.prisma as any).mobileSession.updateMany({
      where: { userId, deviceId },
      data: { isActive: false },
    });
    this.logger.log(`User ${userId} logged out from device ${deviceId}`);
  }

  async logoutAllDevices(userId: string): Promise<void> {
    await (this.prisma as any).mobileSession.updateMany({
      where: { userId },
      data: { isActive: false },
    });
    this.logger.log(`User ${userId} logged out from all devices`);
  }

  async updatePushToken(deviceId: string, pushToken: string, pushProvider: 'fcm' | 'apns' = 'fcm'): Promise<void> {
    await (this.prisma as any).mobileDevice.update({
      where: { id: deviceId },
      data: { pushToken, pushProvider },
    });
    this.logger.log(`Push token updated for device ${deviceId}`);
  }

  async getActiveDevices(userId: string) {
    const devices = await (this.prisma as any).mobileDevice.findMany({
      where: { userId, isActive: true },
      include: { _count: { select: { sessions: { where: { isActive: true } } } } },
      orderBy: { lastActiveAt: 'desc' },
    });

    return devices.map((d: any) => ({
      id: d.id,
      device_type: d.deviceType,
      device_name: d.deviceName,
      device_model: d.deviceModel,
      os_version: d.osVersion,
      app_version: d.appVersion,
      last_active_at: d.lastActiveAt,
      registered_at: d.registeredAt,
      active_sessions: d._count?.sessions || 0,
    }));
  }

  async deactivateDevice(userId: string, deviceId: string): Promise<void> {
    await (this.prisma as any).mobileDevice.update({
      where: { id: deviceId, userId },
      data: { isActive: false },
    });
    await (this.prisma as any).mobileSession.updateMany({
      where: { deviceId },
      data: { isActive: false },
    });
    this.logger.log(`Device ${deviceId} deactivated for user ${userId}`);
  }

  async cleanupExpiredSessions(): Promise<number> {
    const result = await (this.prisma as any).mobileSession.updateMany({
      where: { expiresAt: { lt: new Date() }, isActive: true },
      data: { isActive: false },
    });
    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  }

  private async findOrCreateDevice(userId: string, registration: DeviceRegistration): Promise<string> {
    if (registration.pushToken) {
      const existing = await (this.prisma as any).mobileDevice.findFirst({
        where: { userId, pushToken: registration.pushToken, isActive: true },
      });
      if (existing) return existing.id;
    }

    const device = await (this.prisma as any).mobileDevice.create({
      data: {
        userId,
        deviceType: registration.deviceType,
        deviceName: registration.deviceName,
        deviceModel: registration.deviceModel,
        osVersion: registration.osVersion,
        appVersion: registration.appVersion,
        pushToken: registration.pushToken,
        lastActiveAt: new Date(),
      },
    });

    return device.id;
  }

  private async updateDeviceInfo(deviceId: string, registration: DeviceRegistration) {
    await (this.prisma as any).mobileDevice.update({
      where: { id: deviceId },
      data: {
        deviceName: registration.deviceName,
        deviceModel: registration.deviceModel,
        osVersion: registration.osVersion,
        appVersion: registration.appVersion,
        pushToken: registration.pushToken,
        lastActiveAt: new Date(),
        isActive: true,
      },
    });
  }

  private async createSession(userId: string, deviceId: string, ipAddress?: string, userAgent?: string): Promise<string> {
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_EXPIRY);

    await (this.prisma as any).mobileSession.updateMany({
      where: { deviceId, isActive: true },
      data: { isActive: false },
    });

    const session = await (this.prisma as any).mobileSession.create({
      data: { userId, deviceId, refreshToken: '', ipAddress, userAgent, expiresAt },
    });

    return session.id;
  }

  private async generateTokens(userId: string, deviceId: string, sessionId: string): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    const accessToken = this.jwtService.sign({ userId, deviceId, sessionId }, { expiresIn: this.ACCESS_TOKEN_EXPIRY });

    const refreshTokenPayload: RefreshTokenPayload = { userId, deviceId, sessionId };
    const refreshToken = this.jwtService.sign(refreshTokenPayload, { expiresIn: `${this.REFRESH_TOKEN_EXPIRY}ms` });

    const accessTokenHash = this.hashToken(accessToken);

    await (this.prisma as any).mobileSession.update({
      where: { id: sessionId },
      data: { refreshToken, accessTokenHash },
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      return this.jwtService.verify<RefreshTokenPayload>(refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async getActiveSession(sessionId: string, refreshToken: string): Promise<any> {
    return (this.prisma as any).mobileSession.findFirst({
      where: { id: sessionId, refreshToken, isActive: true, expiresAt: { gt: new Date() } },
    });
  }

  private async updateSessionLastUsed(sessionId: string) {
    await (this.prisma as any).mobileSession.update({
      where: { id: sessionId },
      data: { lastUsedAt: new Date() },
    });
  }

  private async updateSessionAccessToken(sessionId: string, accessToken: string) {
    await (this.prisma as any).mobileSession.update({
      where: { id: sessionId },
      data: { accessTokenHash: this.hashToken(accessToken) },
    });
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
