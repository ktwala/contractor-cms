import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ApiKeyService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Generate a new API key
   */
  async generateApiKey(data: {
    name: string;
    scopes: string[];
    organizationId?: string;
    createdBy: string;
    expiresAt?: Date;
  }): Promise<{ apiKey: string; record: any }> {
    // Generate random API key
    const apiKey = `cms_${this.generateRandomKey(32)}`;

    // Hash the API key
    const keyHash = this.hashApiKey(apiKey);

    // Extract prefix for easy identification
    const keyPrefix = apiKey.substring(0, 10);

    // Create record
    const record = await this.prisma.apiKey.create({
      data: {
        name: data.name,
        keyHash,
        keyPrefix,
        scopes: data.scopes,
        organizationId: data.organizationId,
        createdBy: data.createdBy,
        expiresAt: data.expiresAt,
        isActive: true,
      },
    });

    // Return the plaintext key (only shown once) and record
    return { apiKey, record };
  }

  /**
   * Validate an API key
   */
  async validateApiKey(apiKey: string): Promise<any> {
    const keyHash = this.hashApiKey(apiKey);

    const apiKeyRecord = await this.prisma.apiKey.findUnique({
      where: { keyHash },
    });

    if (!apiKeyRecord) {
      throw new UnauthorizedException('Invalid API key');
    }

    if (!apiKeyRecord.isActive) {
      throw new UnauthorizedException('API key is inactive');
    }

    if (apiKeyRecord.expiresAt && apiKeyRecord.expiresAt < new Date()) {
      throw new UnauthorizedException('API key has expired');
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKeyRecord.id },
      data: { lastUsedAt: new Date() },
    });

    return apiKeyRecord;
  }

  /**
   * Hash API key using SHA-256 with salt
   */
  private hashApiKey(apiKey: string): string {
    const salt = this.configService.get<string>('API_KEY_SALT');
    return crypto
      .createHmac('sha256', salt)
      .update(apiKey)
      .digest('hex');
  }

  /**
   * Generate random key
   */
  private generateRandomKey(length: number): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Revoke (deactivate) an API key
   */
  async revokeApiKey(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * List API keys for an organization
   */
  async listApiKeys(organizationId?: string) {
    return this.prisma.apiKey.findMany({
      where: organizationId ? { organizationId } : {},
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        isActive: true,
        expiresAt: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
  }
}
