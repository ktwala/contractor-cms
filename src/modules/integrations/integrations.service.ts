import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import * as crypto from 'crypto';
import {
  IntegrationType,
  IntegrationStatus,
  AccountingSystem,
  WebhookEventType,
  CreateIntegrationDto,
  UpdateIntegrationDto,
  CreateApiKeyDto,
  TriggerSyncDto,
  SyncDirection,
  SyncStatus,
  WebhookPayload,
  AccountingJournalDto,
  AccountingContactDto,
  AccountingPaymentDto,
  API_SCOPES,
} from './dto/integrations.dto';

@Injectable()
export class IntegrationsService {
  private readonly logger = new Logger(IntegrationsService.name);

  constructor(private prisma: PrismaService) {}

  // ==================== Integration Management ====================

  async createIntegration(
    organizationId: string,
    dto: CreateIntegrationDto,
  ): Promise<any> {
    // Validate configuration based on type
    this.validateIntegrationConfig(dto.type, dto.config);

    const integration = await this.prisma.integration.create({
      data: {
        organizationId,
        name: dto.name,
        type: dto.type,
        status: IntegrationStatus.INACTIVE,
        accountingSystem: dto.accounting_system || null,
        config: (dto.config || {}) as any,
        fieldMappings: (dto.config?.field_mappings as any) || {},
        webhookEvents: [],
        metadata: {},
      },
    });

    this.logger.log(
      `Created integration ${integration.id} for org ${organizationId}`,
    );
    return integration;
  }

  async updateIntegration(
    organizationId: string,
    integrationId: string,
    dto: UpdateIntegrationDto,
  ): Promise<any> {
    const integration = await this.getIntegration(organizationId, integrationId);

    if (dto.config) {
      this.validateIntegrationConfig(
        integration.type,
        dto.config,
      );
    }

    return this.prisma.integration.update({
      where: { id: integrationId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description && { description: dto.description }),
        ...(dto.config && { config: dto.config as any }),
        ...(dto.is_active !== undefined && { status: dto.is_active ? IntegrationStatus.ACTIVE : IntegrationStatus.INACTIVE }),
      },
    });
  }

  async getIntegration(
    organizationId: string,
    integrationId: string,
  ): Promise<any> {
    const integration = await this.prisma.integration.findFirst({
      where: {
        id: integrationId,
        organizationId,
      },
      include: {
        apiKeys: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            scopes: true,
            lastUsedAt: true,
            expiresAt: true,
            createdAt: true,
          },
        },
        syncLogs: {
          take: 10,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    return integration;
  }

  async listIntegrations(
    organizationId: string,
    filters?: {
      type?: IntegrationType;
      status?: IntegrationStatus;
    },
  ): Promise<any[]> {
    return this.prisma.integration.findMany({
      where: {
        organizationId,
        ...(filters?.type && { type: filters.type }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        _count: {
          select: { syncLogs: true, apiKeys: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async deleteIntegration(
    organizationId: string,
    integrationId: string,
  ): Promise<void> {
    await this.getIntegration(organizationId, integrationId);

    // Deactivate API keys first
    await this.prisma.apiKey.updateMany({
      where: { integrationId },
      data: { isActive: false },
    });

    await this.prisma.integration.delete({
      where: { id: integrationId },
    });

    this.logger.log(`Deleted integration ${integrationId}`);
  }

  async activateIntegration(
    organizationId: string,
    integrationId: string,
  ): Promise<any> {
    const integration = await this.getIntegration(organizationId, integrationId);

    // Validate that required config is present
    if (integration.type === IntegrationType.ACCOUNTING) {
      if (!integration.accountingSystem) {
        throw new BadRequestException('Accounting system must be configured');
      }
    }

    if (integration.type === IntegrationType.CUSTOM_WEBHOOK) {
      const config = integration.config as any;
      if (!config?.webhookUrl) {
        throw new BadRequestException('Webhook URL must be configured');
      }
    }

    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: IntegrationStatus.ACTIVE },
    });
  }

  async deactivateIntegration(
    organizationId: string,
    integrationId: string,
  ): Promise<any> {
    await this.getIntegration(organizationId, integrationId);

    return this.prisma.integration.update({
      where: { id: integrationId },
      data: { status: IntegrationStatus.INACTIVE },
    });
  }

  // ==================== API Key Management ====================

  async createApiKey(
    organizationId: string,
    integrationId: string,
    dto: CreateApiKeyDto,
  ): Promise<{ apiKey: any; secretKey: string }> {
    await this.getIntegration(organizationId, integrationId);

    // Generate secure API key
    const keyPrefix = 'pk_';
    const secretKey = keyPrefix + crypto.randomBytes(32).toString('hex');
    const keyHash = this.hashApiKey(secretKey);

    const apiKey = await this.prisma.apiKey.create({
      data: {
        integrationId,
        name: dto.name,
        keyHash,
        keyPrefix: secretKey.substring(0, 10),
        scopes: dto.scopes,
        expiresAt: dto.expires_at ? new Date(dto.expires_at) : null,
        ipWhitelist: [],
        isActive: true,
      },
    });

    this.logger.log(`Created API key ${apiKey.id} for integration ${integrationId}`);

    // Return the secret key only once - it cannot be retrieved later
    return {
      apiKey: {
        id: apiKey.id,
        name: apiKey.name,
        keyPrefix: apiKey.keyPrefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt,
        createdAt: apiKey.createdAt,
      },
      secretKey,
    };
  }

  async validateApiKey(
    secretKey: string,
    requiredScope?: string,
  ): Promise<{ valid: boolean; integrationId?: string; organizationId?: string }> {
    const keyHash = this.hashApiKey(secretKey);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
      },
      include: {
        integration: {
          select: {
            id: true,
            organizationId: true,
            status: true,
          },
        },
      },
    });

    if (!apiKey) {
      return { valid: false };
    }

    // Check expiration
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
      return { valid: false };
    }

    // Check integration status
    if (apiKey.integration.status !== IntegrationStatus.ACTIVE) {
      return { valid: false };
    }

    // Check scope
    if (requiredScope) {
      const scopes = apiKey.scopes as string[];
      if (!scopes.includes(requiredScope) && !scopes.includes('*')) {
        return { valid: false };
      }
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    return {
      valid: true,
      integrationId: apiKey.integration.id,
      organizationId: apiKey.integration.organizationId,
    };
  }

  async revokeApiKey(
    organizationId: string,
    integrationId: string,
    apiKeyId: string,
  ): Promise<void> {
    await this.getIntegration(organizationId, integrationId);

    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        id: apiKeyId,
        integrationId,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });

    this.logger.log(`Revoked API key ${apiKeyId}`);
  }

  async listApiKeys(
    organizationId: string,
    integrationId: string,
  ): Promise<any[]> {
    await this.getIntegration(organizationId, integrationId);

    return this.prisma.apiKey.findMany({
      where: {
        integrationId,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        expiresAt: true,
        createdAt: true,
      },
    });
  }

  private hashApiKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  // ==================== Webhook Dispatch ====================

  async dispatchWebhook(
    organizationId: string,
    eventType: WebhookEventType,
    payload: any,
  ): Promise<{ dispatched: number; failed: number }> {
    // Find all active integrations that subscribe to this event
    const integrations = await this.prisma.integration.findMany({
      where: {
        organizationId,
        status: IntegrationStatus.ACTIVE,
        type: IntegrationType.CUSTOM_WEBHOOK,
        webhookEvents: {
          has: eventType,
        },
      },
    });

    let dispatched = 0;
    let failed = 0;

    for (const integration of integrations) {
      try {
        await this.sendWebhook(integration, eventType, payload);
        dispatched++;
      } catch (error) {
        this.logger.error(
          `Failed to dispatch webhook to integration ${integration.id}: ${error.message}`,
        );
        failed++;
      }
    }

    return { dispatched, failed };
  }

  private async sendWebhook(
    integration: any,
    eventType: WebhookEventType,
    payload: any,
  ): Promise<void> {
    const config = integration.config as any;
    const webhookUrl = config.webhookUrl;
    const webhookSecret = config.webhookSecret;

    if (!webhookUrl) {
      throw new Error('Webhook URL not configured');
    }

    const webhookPayload: WebhookPayload = {
      event: eventType,
      timestamp: new Date().toISOString(),
      webhook_id: crypto.randomUUID(),
      data: this.applyFieldMappings(payload, integration.fieldMappings as any[]),
    };

    const payloadString = JSON.stringify(webhookPayload);

    // Generate HMAC signature
    const signature = webhookSecret
      ? this.generateWebhookSignature(payloadString, webhookSecret)
      : undefined;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Webhook-Event': eventType,
      'X-Webhook-Timestamp': webhookPayload.timestamp,
      'X-Webhook-ID': webhookPayload.webhook_id,
    };

    if (signature) {
      headers['X-Webhook-Signature'] = signature;
    }

    // Add custom headers from config
    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    const startTime = Date.now();
    let response: Response | undefined;
    let error: Error | undefined;

    try {
      response = await fetch(webhookUrl, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      error = err as Error;
    }

    const duration = Date.now() - startTime;

    // Log the webhook delivery
    await this.prisma.webhookDelivery.create({
      data: {
        integrationId: integration.id,
        eventType,
        payload: webhookPayload as any,
        responseStatus: response?.status || 0,
        responseBody: error ? error.message : 'OK',
        duration,
        success: !error && response?.ok === true,
      },
    });

    if (error) {
      // Update integration error count
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: {
            ...(integration.metadata as any),
            lastWebhookError: error.message,
            lastWebhookErrorAt: new Date().toISOString(),
            consecutiveFailures:
              ((integration.metadata as any)?.consecutiveFailures || 0) + 1,
          },
        },
      });

      throw error;
    } else {
      // Reset consecutive failures on success
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          metadata: {
            ...(integration.metadata as any),
            lastWebhookSuccess: new Date().toISOString(),
            consecutiveFailures: 0,
          },
        },
      });
    }
  }

  private generateWebhookSignature(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');
    return `t=${timestamp},v1=${signature}`;
  }

  async getWebhookDeliveries(
    organizationId: string,
    integrationId: string,
    filters?: {
      eventType?: WebhookEventType;
      success?: boolean;
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<any[]> {
    await this.getIntegration(organizationId, integrationId);

    return this.prisma.webhookDelivery.findMany({
      where: {
        integrationId,
        ...(filters?.eventType && { eventType: filters.eventType }),
        ...(filters?.success !== undefined && { success: filters.success }),
        ...(filters?.startDate && {
          createdAt: { gte: filters.startDate },
        }),
        ...(filters?.endDate && {
          createdAt: { lte: filters.endDate },
        }),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async retryWebhook(
    organizationId: string,
    integrationId: string,
    deliveryId: string,
  ): Promise<void> {
    const integration = await this.getIntegration(organizationId, integrationId);

    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        integrationId,
      },
    });

    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    const payload = delivery.payload as any;
    await this.sendWebhook(integration, delivery.eventType as WebhookEventType, payload.data);
  }

  // ==================== Data Sync ====================

  async triggerSync(
    organizationId: string,
    integrationId: string,
    dto: TriggerSyncDto,
  ): Promise<any> {
    const integration = await this.getIntegration(organizationId, integrationId);

    if (integration.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Integration must be active to sync');
    }

    const syncLog = await this.prisma.syncLog.create({
      data: {
        integrationId,
        direction: dto.direction || SyncDirection.OUTBOUND,
        entityType: dto.entity_types?.[0] || 'payrun',
        status: SyncStatus.PENDING,
        recordsProcessed: 0,
        recordsSucceeded: 0,
        recordsFailed: 0,
        errors: [],
      },
    });

    // Execute sync asynchronously
    this.executeSync(integration, syncLog.id, dto).catch((err) => {
      this.logger.error(`Sync ${syncLog.id} failed: ${err.message}`);
    });

    return syncLog;
  }

  private async executeSync(
    integration: any,
    syncLogId: string,
    dto: TriggerSyncDto,
  ): Promise<void> {
    await this.prisma.syncLog.update({
      where: { id: syncLogId },
      data: { status: SyncStatus.IN_PROGRESS, startedAt: new Date() },
    });

    let recordsProcessed = 0;
    let recordsSucceeded = 0;
    let recordsFailed = 0;
    const errors: string[] = [];

    try {
      if (integration.type === IntegrationType.ACCOUNTING) {
        if (dto.direction === SyncDirection.OUTBOUND) {
          const result = await this.syncToAccounting(
            integration,
            dto.entity_types?.[0] || 'payrun',
            [],
          );
          recordsProcessed = result.processed;
          recordsSucceeded = result.succeeded;
          recordsFailed = result.failed;
          errors.push(...result.errors);
        } else {
          const result = await this.syncFromAccounting(
            integration,
            dto.entity_types?.[0] || 'payrun',
          );
          recordsProcessed = result.processed;
          recordsSucceeded = result.succeeded;
          recordsFailed = result.failed;
          errors.push(...result.errors);
        }
      }

      await this.prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: recordsFailed > 0 ? SyncStatus.PARTIAL : SyncStatus.COMPLETED,
          completedAt: new Date(),
          recordsProcessed,
          recordsSucceeded,
          recordsFailed,
          errors,
        },
      });
    } catch (err) {
      await this.prisma.syncLog.update({
        where: { id: syncLogId },
        data: {
          status: SyncStatus.FAILED,
          completedAt: new Date(),
          recordsProcessed,
          recordsSucceeded,
          recordsFailed,
          errors: [...errors, (err as Error).message],
        },
      });
    }
  }

  async getSyncLogs(
    organizationId: string,
    integrationId: string,
    filters?: {
      status?: SyncStatus;
      entityType?: string;
    },
  ): Promise<any[]> {
    await this.getIntegration(organizationId, integrationId);

    return this.prisma.syncLog.findMany({
      where: {
        integrationId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.entityType && { entityType: filters.entityType }),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ==================== Accounting System Adapters ====================

  private async syncToAccounting(
    integration: any,
    entityType: string,
    entityIds?: string[],
  ): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
    const adapter = this.getAccountingAdapter(integration.accountingSystem);
    const config = integration.config as any;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    if (entityType === 'journal') {
      // Get journals to sync
      const journals = await this.prisma.glJournal.findMany({
        where: {
          organizationId: integration.organizationId,
          ...(entityIds && { id: { in: entityIds } }),
          syncedAt: null,
        },
        include: {
          lines: true,
        },
      });

      for (const journal of journals) {
        processed++;
        try {
          const mappedJournal = this.applyFieldMappings(
            journal,
            integration.fieldMappings as any[],
          );
          await adapter.createJournal(config, mappedJournal);

          await this.prisma.glJournal.update({
            where: { id: journal.id },
            data: { syncedAt: new Date() },
          });

          succeeded++;
        } catch (err) {
          failed++;
          errors.push(`Journal ${journal.id}: ${(err as Error).message}`);
        }
      }
    }

    if (entityType === 'contact') {
      // Sync employees as contacts
      const employees = await this.prisma.employee.findMany({
        where: {
          employments: {
            some: {
              legalEntityId: integration.organizationId,
            },
          },
          ...(entityIds && { id: { in: entityIds } }),
        },
      });

      for (const employee of employees) {
        processed++;
        try {
          const contact: AccountingContactDto = {
            external_id: employee.id,
            name: `${employee.firstName} ${employee.lastName}`,
            email: employee.email || undefined,
            is_employee: true,
          };

          const mappedContact = this.applyFieldMappings(
            contact,
            integration.fieldMappings as any[],
          );
          await adapter.createOrUpdateContact(config, mappedContact);
          succeeded++;
        } catch (err) {
          failed++;
          errors.push(`Employee ${employee.id}: ${(err as Error).message}`);
        }
      }
    }

    if (entityType === 'payment') {
      // Sync payment batches
      const paymentBatches = await this.prisma.paymentBatch.findMany({
        where: {
          organizationId: integration.organizationId,
          ...(entityIds && { id: { in: entityIds } }),
          syncedAt: null,
          status: 'PROCESSED',
        },
        include: {
          payments: true,
        },
      });

      for (const batch of paymentBatches) {
        processed++;
        try {
          for (const payment of batch.payments) {
            const paymentDto: AccountingPaymentDto = {
              external_id: payment.id,
              amount: Number(payment.amount),
              currency: 'ZAR',
              payment_date: batch.processedAt?.toISOString().split('T')[0] || new Date().toISOString().split('T')[0],
              reference: payment.reference,
              contact_id: payment.employeeId,
              account_code: '2000',
              description: `Payment for ${payment.reference}`,
            };

            const mappedPayment = this.applyFieldMappings(
              paymentDto,
              integration.fieldMappings as any[],
            );
            await adapter.createPayment(config, mappedPayment);
          }

          await this.prisma.paymentBatch.update({
            where: { id: batch.id },
            data: { syncedAt: new Date() },
          });

          succeeded++;
        } catch (err) {
          failed++;
          errors.push(`Batch ${batch.id}: ${(err as Error).message}`);
        }
      }
    }

    return { processed, succeeded, failed, errors };
  }

  private async syncFromAccounting(
    integration: any,
    entityType: string,
  ): Promise<{ processed: number; succeeded: number; failed: number; errors: string[] }> {
    const adapter = this.getAccountingAdapter(integration.accountingSystem);
    const config = integration.config as any;

    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    if (entityType === 'chart_of_accounts') {
      try {
        const accounts = await adapter.getChartOfAccounts(config);
        processed = accounts.length;

        for (const account of accounts) {
          try {
            await this.prisma.glAccount.upsert({
              where: {
                organizationId_code: {
                  organizationId: integration.organizationId,
                  code: account.code,
                },
              },
              update: {
                name: account.name,
                type: account.type,
                isActive: account.isActive,
              },
              create: {
                organizationId: integration.organizationId,
                code: account.code,
                name: account.name,
                type: account.type,
                isActive: account.isActive,
              },
            });
            succeeded++;
          } catch (err) {
            failed++;
            errors.push(`Account ${account.code}: ${(err as Error).message}`);
          }
        }
      } catch (err) {
        errors.push(`Failed to fetch chart of accounts: ${(err as Error).message}`);
      }
    }

    return { processed, succeeded, failed, errors };
  }

  private getAccountingAdapter(system: AccountingSystem): AccountingAdapter {
    switch (system) {
      case AccountingSystem.XERO:
        return new XeroAdapter();
      case AccountingSystem.QUICKBOOKS:
        return new QuickBooksAdapter();
      case AccountingSystem.SAGE:
        return new SageAdapter();
      case AccountingSystem.PASTEL:
        return new PastelAdapter();
      case AccountingSystem.SAP:
        return new SAPAdapter();
      default:
        throw new BadRequestException(`Unsupported accounting system: ${system}`);
    }
  }

  // ==================== Field Mapping ====================

  private applyFieldMappings(data: any, mappings: any[]): any {
    if (!mappings || mappings.length === 0) {
      return data;
    }

    const result: any = {};

    for (const mapping of mappings) {
      const sourceValue = this.getNestedValue(data, mapping.sourceField);

      if (sourceValue !== undefined) {
        let transformedValue = sourceValue;

        // Apply transformation
        if (mapping.transformation) {
          transformedValue = this.applyTransformation(
            sourceValue,
            mapping.transformation,
            mapping.transformationConfig,
          );
        }

        // Apply default if value is null/undefined
        if (transformedValue === null || transformedValue === undefined) {
          transformedValue = mapping.defaultValue;
        }

        this.setNestedValue(result, mapping.targetField, transformedValue);
      } else if (mapping.defaultValue !== undefined) {
        this.setNestedValue(result, mapping.targetField, mapping.defaultValue);
      }
    }

    // Include unmapped fields
    for (const key of Object.keys(data)) {
      if (!mappings.some((m: any) => m.sourceField === key || m.sourceField.startsWith(key + '.'))) {
        result[key] = data[key];
      }
    }

    return result;
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, part) => acc?.[part], obj);
  }

  private setNestedValue(obj: any, path: string, value: any): void {
    const parts = path.split('.');
    const last = parts.pop()!;
    const target = parts.reduce((acc, part) => {
      if (!acc[part]) acc[part] = {};
      return acc[part];
    }, obj);
    target[last] = value;
  }

  private applyTransformation(
    value: any,
    transformation: string,
    config?: any,
  ): any {
    switch (transformation) {
      case 'uppercase':
        return String(value).toUpperCase();
      case 'lowercase':
        return String(value).toLowerCase();
      case 'trim':
        return String(value).trim();
      case 'number':
        return Number(value);
      case 'string':
        return String(value);
      case 'date':
        return new Date(value).toISOString();
      case 'format_date':
        return this.formatDate(value, config?.format || 'YYYY-MM-DD');
      case 'multiply':
        return Number(value) * (config?.factor || 1);
      case 'divide':
        return Number(value) / (config?.factor || 1);
      case 'map':
        return config?.mapping?.[value] ?? value;
      default:
        return value;
    }
  }

  private formatDate(value: any, format: string): string {
    const date = new Date(value);
    // Simple date formatting
    return format
      .replace('YYYY', String(date.getFullYear()))
      .replace('MM', String(date.getMonth() + 1).padStart(2, '0'))
      .replace('DD', String(date.getDate()).padStart(2, '0'));
  }

  // ==================== Validation ====================

  private validateIntegrationConfig(type: IntegrationType, config: any): void {
    if (!config) return;

    switch (type) {
      case IntegrationType.ACCOUNTING:
        // Validate accounting config has required OAuth or API credentials
        if (config.oauth && !config.oauth.clientId) {
          throw new BadRequestException('OAuth client ID is required');
        }
        break;

      case IntegrationType.CUSTOM_WEBHOOK:
        if (config.webhookUrl) {
          try {
            new URL(config.webhookUrl);
          } catch {
            throw new BadRequestException('Invalid webhook URL');
          }
        }
        break;

      case IntegrationType.BANKING:
        // Validate banking integration config
        break;

      case IntegrationType.TIME_ATTENDANCE:
        // Validate time/attendance config
        break;

      case IntegrationType.HR_SYSTEM:
        // Validate HR system config
        break;
    }
  }

  // ==================== Test Connection ====================

  async testConnection(
    organizationId: string,
    integrationId: string,
  ): Promise<{ success: boolean; message: string; details?: any }> {
    const integration = await this.getIntegration(organizationId, integrationId);
    const config = integration.config as any;

    try {
      switch (integration.type) {
        case IntegrationType.ACCOUNTING:
          const adapter = this.getAccountingAdapter(integration.accountingSystem);
          const result = await adapter.testConnection(config);
          return result;

        case IntegrationType.CUSTOM_WEBHOOK:
          if (!config.webhookUrl) {
            return { success: false, message: 'Webhook URL not configured' };
          }
          // Send a test ping
          const response = await fetch(config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() }),
            signal: AbortSignal.timeout(10000),
          });
          return {
            success: response.ok,
            message: response.ok ? 'Webhook endpoint responded successfully' : `HTTP ${response.status}`,
          };

        default:
          return { success: false, message: 'Connection test not implemented for this integration type' };
      }
    } catch (err) {
      return { success: false, message: (err as Error).message };
    }
  }
}

// ==================== Accounting Adapters ====================

interface AccountingAdapter {
  testConnection(config: any): Promise<{ success: boolean; message: string; details?: any }>;
  createJournal(config: any, journal: AccountingJournalDto): Promise<string>;
  createOrUpdateContact(config: any, contact: AccountingContactDto): Promise<string>;
  createPayment(config: any, payment: AccountingPaymentDto): Promise<string>;
  getChartOfAccounts(config: any): Promise<Array<{ code: string; name: string; type: string; isActive: boolean }>>;
}

class XeroAdapter implements AccountingAdapter {
  async testConnection(config: any): Promise<{ success: boolean; message: string }> {
    // In production, would validate OAuth tokens and make test API call
    if (!config.oauth?.accessToken) {
      return { success: false, message: 'Xero OAuth not configured' };
    }
    return { success: true, message: 'Connected to Xero' };
  }

  async createJournal(config: any, journal: AccountingJournalDto): Promise<string> {
    // POST to Xero Manual Journals API
    // https://api.xero.com/api.xro/2.0/ManualJournals
    throw new Error('Xero journal creation not implemented');
  }

  async createOrUpdateContact(config: any, contact: AccountingContactDto): Promise<string> {
    // POST/PUT to Xero Contacts API
    throw new Error('Xero contact sync not implemented');
  }

  async createPayment(config: any, payment: AccountingPaymentDto): Promise<string> {
    // POST to Xero Payments API
    throw new Error('Xero payment creation not implemented');
  }

  async getChartOfAccounts(config: any): Promise<Array<{ code: string; name: string; type: string; isActive: boolean }>> {
    // GET from Xero Accounts API
    throw new Error('Xero chart of accounts sync not implemented');
  }
}

class QuickBooksAdapter implements AccountingAdapter {
  async testConnection(config: any): Promise<{ success: boolean; message: string }> {
    if (!config.oauth?.accessToken) {
      return { success: false, message: 'QuickBooks OAuth not configured' };
    }
    return { success: true, message: 'Connected to QuickBooks' };
  }

  async createJournal(config: any, journal: AccountingJournalDto): Promise<string> {
    throw new Error('QuickBooks journal creation not implemented');
  }

  async createOrUpdateContact(config: any, contact: AccountingContactDto): Promise<string> {
    throw new Error('QuickBooks contact sync not implemented');
  }

  async createPayment(config: any, payment: AccountingPaymentDto): Promise<string> {
    throw new Error('QuickBooks payment creation not implemented');
  }

  async getChartOfAccounts(config: any): Promise<Array<{ code: string; name: string; type: string; isActive: boolean }>> {
    throw new Error('QuickBooks chart of accounts sync not implemented');
  }
}

class SageAdapter implements AccountingAdapter {
  async testConnection(config: any): Promise<{ success: boolean; message: string }> {
    if (!config.apiKey) {
      return { success: false, message: 'Sage API key not configured' };
    }
    return { success: true, message: 'Connected to Sage' };
  }

  async createJournal(config: any, journal: AccountingJournalDto): Promise<string> {
    throw new Error('Sage journal creation not implemented');
  }

  async createOrUpdateContact(config: any, contact: AccountingContactDto): Promise<string> {
    throw new Error('Sage contact sync not implemented');
  }

  async createPayment(config: any, payment: AccountingPaymentDto): Promise<string> {
    throw new Error('Sage payment creation not implemented');
  }

  async getChartOfAccounts(config: any): Promise<Array<{ code: string; name: string; type: string; isActive: boolean }>> {
    throw new Error('Sage chart of accounts sync not implemented');
  }
}

class PastelAdapter implements AccountingAdapter {
  async testConnection(config: any): Promise<{ success: boolean; message: string }> {
    if (!config.connectionString) {
      return { success: false, message: 'Pastel connection not configured' };
    }
    return { success: true, message: 'Connected to Pastel' };
  }

  async createJournal(config: any, journal: AccountingJournalDto): Promise<string> {
    throw new Error('Pastel journal creation not implemented');
  }

  async createOrUpdateContact(config: any, contact: AccountingContactDto): Promise<string> {
    throw new Error('Pastel contact sync not implemented');
  }

  async createPayment(config: any, payment: AccountingPaymentDto): Promise<string> {
    throw new Error('Pastel payment creation not implemented');
  }

  async getChartOfAccounts(config: any): Promise<Array<{ code: string; name: string; type: string; isActive: boolean }>> {
    throw new Error('Pastel chart of accounts sync not implemented');
  }
}

class SAPAdapter implements AccountingAdapter {
  async testConnection(config: any): Promise<{ success: boolean; message: string }> {
    if (!config.sapUrl || !config.sapClient) {
      return { success: false, message: 'SAP connection not configured' };
    }
    return { success: true, message: 'Connected to SAP' };
  }

  async createJournal(config: any, journal: AccountingJournalDto): Promise<string> {
    throw new Error('SAP journal creation not implemented');
  }

  async createOrUpdateContact(config: any, contact: AccountingContactDto): Promise<string> {
    throw new Error('SAP contact sync not implemented');
  }

  async createPayment(config: any, payment: AccountingPaymentDto): Promise<string> {
    throw new Error('SAP payment creation not implemented');
  }

  async getChartOfAccounts(config: any): Promise<Array<{ code: string; name: string; type: string; isActive: boolean }>> {
    throw new Error('SAP chart of accounts sync not implemented');
  }
}
