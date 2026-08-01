import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

interface AuditLogEntry {
  legal_entity_id?: string;
  user_id?: string;
  action_type: string;
  entity_type: string;
  entity_id?: string;
  entity_description?: string;
  old_values?: any;
  new_values?: any;
  changes?: any;
  ip_address?: string;
  user_agent?: string;
  session_id?: string;
  api_endpoint?: string;
  request_method?: string;
  status_code?: number;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  tags?: string[];
  metadata?: any;
}

interface AuditQuery {
  legal_entity_id?: string;
  user_id?: string;
  action_type?: string;
  entity_type?: string;
  entity_id?: string;
  severity?: string;
  from_date?: string;
  to_date?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditTrailService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Log an audit entry - uses existing AuditLog model
   */
  async logAudit(entry: AuditLogEntry): Promise<string> {
    const audit = await (this.prisma as any).auditLog.create({
      data: {
        userId: entry.user_id || null,
        action: entry.action_type,
        entityType: entry.entity_type,
        entityId: entry.entity_id || '',
        oldValue: entry.old_values || null,
        newValue: entry.new_values || null,
        reason: entry.entity_description || null,
        ipAddress: entry.ip_address || null,
        userAgent: entry.user_agent || null,
      },
    });

    return audit.id;
  }

  /**
   * Log a CREATE action
   */
  async logCreate(
    entityType: string,
    entityId: string,
    newValues: any,
    userId: string,
    legalEntityId?: string,
    metadata?: any,
  ): Promise<string> {
    return this.logAudit({
      legal_entity_id: legalEntityId,
      user_id: userId || undefined,
      action_type: 'create',
      entity_type: entityType,
      entity_id: entityId,
      new_values: newValues,
      severity: 'info',
      metadata,
    });
  }

  /**
   * Log an UPDATE action with change tracking
   */
  async logUpdate(
    entityType: string,
    entityId: string,
    oldValues: any,
    newValues: any,
    userId: string,
    legalEntityId?: string,
    metadata?: any,
  ): Promise<string> {
    const changes = this.calculateChanges(oldValues, newValues);

    return this.logAudit({
      legal_entity_id: legalEntityId,
      user_id: userId || undefined,
      action_type: 'update',
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      new_values: newValues,
      changes,
      severity: 'info',
      metadata,
    });
  }

  /**
   * Log a DELETE action
   */
  async logDelete(
    entityType: string,
    entityId: string,
    oldValues: any,
    userId: string,
    legalEntityId?: string,
    metadata?: any,
  ): Promise<string> {
    return this.logAudit({
      legal_entity_id: legalEntityId,
      user_id: userId || undefined,
      action_type: 'delete',
      entity_type: entityType,
      entity_id: entityId,
      old_values: oldValues,
      severity: 'warning',
      metadata,
    });
  }

  /**
   * Log a security event (login, logout, failed login)
   */
  async logSecurityEvent(
    actionType: 'login' | 'logout' | 'failed_login' | 'password_change' | 'mfa_enabled',
    userId: string | null,
    ipAddress: string,
    userAgent: string,
    metadata?: any,
  ): Promise<string> {
    return this.logAudit({
      user_id: userId || undefined,
      action_type: actionType,
      entity_type: 'user_session',
      ip_address: ipAddress,
      user_agent: userAgent,
      severity: actionType === 'failed_login' ? 'warning' : 'info',
      tags: ['security'],
      metadata,
    });
  }

  /**
   * Log a compliance action
   */
  async logComplianceAction(
    actionType: string,
    entityType: string,
    entityId: string,
    userId: string,
    legalEntityId: string,
    metadata?: any,
  ): Promise<string> {
    return this.logAudit({
      legal_entity_id: legalEntityId,
      user_id: userId || undefined,
      action_type: actionType,
      entity_type: entityType,
      entity_id: entityId,
      severity: 'info',
      tags: ['compliance'],
      metadata,
    });
  }

  /**
   * Log a data export (POPIA compliance)
   */
  async logDataExport(
    exportType: string,
    recordCount: number,
    userId: string,
    legalEntityId?: string,
    metadata?: any,
  ): Promise<string> {
    return this.logAudit({
      legal_entity_id: legalEntityId,
      user_id: userId || undefined,
      action_type: 'export',
      entity_type: exportType,
      severity: 'warning',
      tags: ['data_export', 'popia'],
      metadata: {
        ...metadata,
        record_count: recordCount,
      },
    });
  }

  /**
   * Query audit logs
   */
  async queryAuditLogs(query: AuditQuery): Promise<any[]> {
    const auditLogs = await (this.prisma as any).auditLog.findMany({
      where: {
        ...(query.user_id && { userId: query.user_id }),
        ...(query.action_type && { action: query.action_type }),
        ...(query.entity_type && { entityType: query.entity_type }),
        ...(query.entity_id && { entityId: query.entity_id }),
        ...(query.from_date && { createdAt: { gte: new Date(query.from_date) } }),
        ...(query.to_date && { createdAt: { lte: new Date(query.to_date) } }),
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit || 100,
      skip: query.offset || 0,
    });

    return auditLogs;
  }

  /**
   * Get audit details for a specific entry
   */
  async getAuditDetails(auditId: string): Promise<any> {
    const audit = await (this.prisma as any).auditLog.findUnique({
      where: { id: auditId },
    });

    if (!audit) {
      throw new Error('Audit log not found');
    }

    return audit;
  }

  /**
   * Get audit history for a specific entity
   */
  async getEntityHistory(entityType: string, entityId: string): Promise<any[]> {
    return (this.prisma as any).auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get compliance audit report
   */
  async getComplianceAuditReport(
    legalEntityId: string,
    fromDate: string,
    toDate: string,
  ): Promise<any> {
    const auditLogs = await (this.prisma as any).auditLog.findMany({
      where: {
        createdAt: {
          gte: new Date(fromDate),
          lte: new Date(toDate),
        },
      },
    });

    // Group by action and entity_type
    const summary = auditLogs.reduce((acc: any[], log: any) => {
      const key = `${log.action}|${log.entityType}`;
      const existing = acc.find(item => item.key === key);
      if (existing) {
        existing.count++;
        existing.uniqueUsers.add(log.userId);
      } else {
        acc.push({
          key,
          action_type: log.action,
          entity_type: log.entityType,
          count: 1,
          uniqueUsers: new Set([log.userId]),
        });
      }
      return acc;
    }, []);

    return {
      legal_entity_id: legalEntityId,
      period: { from: fromDate, to: toDate },
      summary: summary.map((item: any) => ({
        action_type: item.action_type,
        entity_type: item.entity_type,
        count: item.count,
        unique_users: item.uniqueUsers.size,
      })),
    };
  }

  /**
   * Calculate changes between old and new values
   */
  private calculateChanges(oldValues: any, newValues: any): any {
    const changes: any = {};

    for (const key in newValues) {
      if (oldValues[key] !== newValues[key]) {
        changes[key] = {
          old: oldValues[key],
          new: newValues[key],
        };
      }
    }

    return changes;
  }

  /**
   * Clean up old audit logs based on retention policy
   */
  async cleanupOldLogs(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await (this.prisma as any).auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate },
      },
    });

    return result.count;
  }
}
