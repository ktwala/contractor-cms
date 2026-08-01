import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface AuditLogEntry {
  userId?: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Canonical security audit event schema (SIEM/log search friendly).
 * Use for SoD violations, privilege-use, and PLATFORM_SUPERADMIN access.
 */
export interface SecurityAuditEvent {
  eventType: string;
  outcome: 'SUCCESS' | 'DENIED';
  actorUserId: string;
  actorRoles: string[];
  permission?: string;
  resourceType?: 'PAYRUN' | 'EMP201' | 'EMP501';
  resourceId?: string;
  legalEntityId?: string;
  sodRule?: 'PR-SOD-01' | 'PR-SOD-02' | 'PR-SOD-03' | 'SARS-SOD-01' | 'SARS-SOD-02';
  endpoint?: string;
  method?: string;
  timestamp: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          oldValue: entry.oldValue as any,
          newValue: entry.newValue as any,
          reason: entry.reason,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch (error) {
      this.logger.error('Failed to write audit log', error);
    }
  }

  async getLogsForEntity(entityType: string, entityId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
  }

  async getLogsForUser(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Log permission-denied event (for auditors).
   * Call before throwing ForbiddenException in permission checks.
   * v1.1: includes legalEntityId and roleAssignments when available.
   */
  async logPermissionDenied(data: {
    userId: string;
    requiredPermissions: string[];
    userRoles: string[];
    endpoint: string;
    method: string;
    legalEntityId?: string | null;
    roleAssignments?: Array<{ role: string; legalEntityId: string | null; scopeType?: string }>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: 'PERMISSION_DENIED',
      entityType: 'Security',
      entityId: `${data.method} ${data.endpoint}`,
      newValue: {
        requiredPermissions: data.requiredPermissions,
        userRoles: data.userRoles,
        endpoint: data.endpoint,
        method: data.method,
        legalEntityId: data.legalEntityId ?? undefined,
        roleAssignments: data.roleAssignments ?? undefined,
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  /** Canonical SoD event codes for SIEM/search */
  static readonly SOD_EVENT_CODES: Record<string, string> = {
    'PR-SOD-01': 'SOD_PAYRUN_CREATOR_APPROVE_DENIED',
    'PR-SOD-02': 'SOD_PAYRUN_APPROVER_PAY_DENIED',
    'PR-SOD-03': 'SOD_PAYRUN_PAYER_FINALIZE_DENIED',
    'SARS-SOD-01': 'SOD_EMP201_GENERATOR_SUBMIT_DENIED',
    'SARS-SOD-02': 'SOD_EMP501_SUBMITTER_APPROVE_DENIED',
  };

  /**
   * Log SoD-denied event (for auditors).
   * Uses canonical event codes for SIEM/log search.
   * v1.1: includes roleAssignments when available.
   */
  async logSodDenied(data: {
    userId: string;
    ruleId: 'PR-SOD-01' | 'PR-SOD-02' | 'PR-SOD-03' | 'SARS-SOD-01' | 'SARS-SOD-02';
    entityType: 'PAYRUN' | 'EMP201' | 'EMP501';
    entityId: string;
    legalEntityId?: string | null;
    actorRoles?: string[];
    roleAssignments?: Array<{ role: string; legalEntityId: string | null; scopeType?: string }>;
    endpoint?: string;
    method?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const eventType = AuditService.SOD_EVENT_CODES[data.ruleId] ?? 'SOD_DENIED';
    const event: SecurityAuditEvent & { roleAssignments?: Array<{ role: string; legalEntityId: string | null; scopeType?: string }> } = {
      eventType,
      outcome: 'DENIED',
      actorUserId: data.userId,
      actorRoles: data.actorRoles ?? [],
      resourceType: data.entityType,
      resourceId: data.entityId,
      legalEntityId: data.legalEntityId ?? undefined,
      sodRule: data.ruleId,
      endpoint: data.endpoint,
      method: data.method,
      timestamp: new Date().toISOString(),
      ...(data.roleAssignments && { roleAssignments: data.roleAssignments }),
    };
    await this.log({
      userId: data.userId,
      action: eventType,
      entityType: 'Security',
      entityId: data.entityId,
      newValue: event as unknown as Record<string, unknown>,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  /**
   * Log PLATFORM_SUPERADMIN access (for auditors).
   * Call when break-glass bypass is used.
   * v1.1: includes roleAssignments when available.
   */
  async logPlatformSuperadminAccess(data: {
    userId: string;
    route: string;
    method: string;
    legalEntityId?: string | null;
    roleAssignments?: Array<{ role: string; legalEntityId: string | null; scopeType?: string }>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    const event: SecurityAuditEvent & { roleAssignments?: Array<{ role: string; legalEntityId: string | null; scopeType?: string }> } = {
      eventType: 'PLATFORM_SUPERADMIN_ACCESS',
      outcome: 'SUCCESS',
      actorUserId: data.userId,
      actorRoles: ['PLATFORM_SUPERADMIN'],
      endpoint: data.route,
      method: data.method,
      legalEntityId: data.legalEntityId ?? undefined,
      timestamp: new Date().toISOString(),
      ...(data.roleAssignments && { roleAssignments: data.roleAssignments }),
    };
    await this.log({
      userId: data.userId,
      action: 'PLATFORM_SUPERADMIN_ACCESS',
      entityType: 'Security',
      entityId: `${data.method} ${data.route}`,
      newValue: event as unknown as Record<string, unknown>,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  /**
   * Log bootstrap admin creation (first admin in environment).
   * For deployment traceability and security accountability.
   */
  async logBootstrapAdminCreated(data: {
    userId: string;
    adminEmail: string;
    source?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      userId: data.userId,
      action: 'BOOTSTRAP_ADMIN_CREATED',
      entityType: 'Security',
      entityId: data.userId,
      newValue: {
        admin_email: data.adminEmail,
        source: data.source ?? 'bootstrap',
        timestamp: new Date().toISOString(),
      },
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
    });
  }

  /**
   * Log bootstrap status check (unauthenticated, no userId).
   * For monitoring and audit of pre-init access.
   */
  async logBootstrapStatusChecked(data?: { ipAddress?: string; userAgent?: string }): Promise<void> {
    await this.log({
      action: 'BOOTSTRAP_STATUS_CHECKED',
      entityType: 'Security',
      entityId: 'bootstrap',
      newValue: { timestamp: new Date().toISOString() },
      ipAddress: data?.ipAddress,
      userAgent: data?.userAgent,
    });
  }

  /**
   * Log bootstrap attempt when users already exist (POST after initialization).
   */
  async logBootstrapAttemptAfterInitialization(data?: {
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await this.log({
      action: 'BOOTSTRAP_ATTEMPT_AFTER_INITIALIZATION',
      entityType: 'Security',
      entityId: 'bootstrap',
      newValue: { timestamp: new Date().toISOString() },
      ipAddress: data?.ipAddress,
      userAgent: data?.userAgent,
    });
  }

  /**
   * Log successful privilege-use (state transition).
   * Uses canonical event codes: PAYRUN_SUBMITTED, PAYRUN_APPROVED, etc.
   */
  async logPrivilegeUse(event: Omit<SecurityAuditEvent, 'outcome' | 'timestamp'>): Promise<void> {
    const fullEvent: SecurityAuditEvent = {
      ...event,
      outcome: 'SUCCESS',
      timestamp: new Date().toISOString(),
    };
    await this.log({
      userId: event.actorUserId,
      action: event.eventType,
      entityType: 'Security',
      entityId: event.resourceId ?? event.eventType,
      newValue: fullEvent as unknown as Record<string, unknown>,
    });
  }
}
