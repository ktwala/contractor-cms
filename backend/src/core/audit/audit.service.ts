import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { ListAuditLogsDto } from './dto/list-audit-logs.dto';
import { AuditResult } from '@prisma/client';

/**
 * Sensitive field names that MUST be redacted before leaving the backend.
 * Case-insensitive matching is performed on object keys.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'passwordhash',
  'token',
  'secret',
  'apikey',
  'refreshtoken',
  'accesstoken',
  'privatekey',
]);

import { isKnownAuditEvent, AUDIT_SEVERITY, AUDIT_EVENTS } from './audit-events.constants';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  // In-memory anomaly tracking (for demo purposes)
  private failedAccessTracker = new Map<string, { count: number; timestamp: number }>();

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Log an action in the database and the system logger.
   */
  async logAction(
    actorUserId: string | null,
    action: string,
    targetType: string,
    targetId: string,
    before?: any,
    after?: any,
    options?: {
      result?: AuditResult;
      organizationId?: string | null;
      severity?: string;
      tags?: string[];
      ipAddress?: string;
      userAgent?: string;
      metadata?: any;
    },
  ) {
    if (!isKnownAuditEvent(action)) {
      this.logger.warn(`Untracked audit event attempted: ${action}`);
    }

    const eventDef = Object.values(AUDIT_EVENTS).find(e => e.action === action);
    let autoSeverity = options?.severity || (eventDef ? eventDef.defaultSeverity : AUDIT_SEVERITY.INFO);
    let autoTags = options?.tags || [];

    if (action === 'ACCESS_DENIED_403' && actorUserId) {
      const now = Date.now();
      const tracker = this.failedAccessTracker.get(actorUserId) || { count: 0, timestamp: now };
      
      // Reset window if older than 5 minutes
      if (now - tracker.timestamp > 5 * 60 * 1000) {
        tracker.count = 1;
        tracker.timestamp = now;
      } else {
        tracker.count += 1;
      }
      this.failedAccessTracker.set(actorUserId, tracker);

      if (tracker.count > 10) {
        autoSeverity = AUDIT_SEVERITY.CRITICAL;
        autoTags = [...new Set([...autoTags, 'ANOMALY_RATE_LIMIT'])];
        this.logger.warn(`[ANOMALY] User ${actorUserId} has >10 failed access attempts in 5 mins.`);
      }
    }

    try {
      await this.prisma.auditLog.create({
        data: {
          actorUserId,
          action,
          targetType,
          targetId,
          organizationId: options?.organizationId ?? null,
          severity: autoSeverity,
          tags: autoTags,
          before: before ? JSON.parse(JSON.stringify(before)) : null,
          after: after ? JSON.parse(JSON.stringify(after)) : null,
          result: options?.result ?? AuditResult.success,
          ipAddress: options?.ipAddress ?? null,
          userAgent: options?.userAgent ?? null,
          metadata: options?.metadata ? JSON.parse(JSON.stringify(options.metadata)) : null,
        },
      });

      this.logger.log(
        `Audit: [${action}] by User ${actorUserId || 'SYSTEM'} on ${targetType}(${targetId}) [Severity: ${autoSeverity}]`,
      );
    } catch (error) {
      // Audit logging failures should not break primary transactions
      this.logger.error(`Failed to create audit log for ${action}`, error);
    }
  }

  // ---------------------------------------------------------------------------
  // Read — Paginated list
  // ---------------------------------------------------------------------------

  async findAllPaginated(params: ListAuditLogsDto) {
    const page = params.page ?? 1;
    const pageSize = Math.min(params.pageSize ?? 50, 100);
    const skip = (page - 1) * pageSize;

    const where = this.buildWhereClause(params);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: data.map((log) => this.sanitizeLog(log)),
      total,
      page,
      pageSize,
    };
  }

  // ---------------------------------------------------------------------------
  // Read — Single detail
  // ---------------------------------------------------------------------------

  async findOne(id: string) {
    const log = await this.prisma.auditLog.findUnique({
      where: { id },
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!log) return null;
    return this.sanitizeLog(log);
  }

  // ---------------------------------------------------------------------------
  // Read — Export (with limits)
  // ---------------------------------------------------------------------------

  /**
   * Returns logs for CSV export with enforced limits.
   * Max 31-day window. Max 10,000 rows.
   */
  async findForExport(params: ListAuditLogsDto) {
    const MAX_EXPORT_ROWS = 10_000;
    const MAX_EXPORT_DAYS = 31;

    // Enforce date range limit
    if (params.from && params.to) {
      const fromDate = new Date(params.from);
      const toDate = new Date(params.to);
      const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDays > MAX_EXPORT_DAYS) {
        throw new Error(`Export date range cannot exceed ${MAX_EXPORT_DAYS} days`);
      }
    }

    const where = this.buildWhereClause(params);

    const data = await this.prisma.auditLog.findMany({
      where,
      include: {
        actor: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: MAX_EXPORT_ROWS,
    });

    return data.map((log) => this.sanitizeLog(log));
  }

  // ---------------------------------------------------------------------------
  // Legacy — keep for backward compatibility
  // ---------------------------------------------------------------------------

  async findAll() {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });
  }

  // ---------------------------------------------------------------------------
  // Private — query builder
  // ---------------------------------------------------------------------------

  private buildWhereClause(params: ListAuditLogsDto) {
    const where: any = {};

    if (params.from || params.to) {
      where.createdAt = {};
      if (params.from) where.createdAt.gte = new Date(params.from);
      if (params.to) where.createdAt.lte = new Date(params.to);
    }

    if (params.actorUserId) {
      where.actorUserId = params.actorUserId;
    }

    if (params.action) {
      where.action = params.action;
    }

    if (params.targetType) {
      where.targetType = params.targetType;
    }

    if (params.organizationId) {
      where.organizationId = params.organizationId;
    }

    if (params.severity) {
      where.severity = params.severity;
    }

    if (params.tags) {
      const tagsArray = params.tags.split(',').map((t) => t.trim());
      where.tags = { hasSome: tagsArray };
    }

    if (params.targetId) {
      where.targetId = params.targetId;
    }

    if (params.result) {
      where.result = params.result;
    }

    // Search restricted to actor email, targetId, action (no JSON fields)
    if (params.search) {
      where.OR = [
        { action: { contains: params.search, mode: 'insensitive' } },
        { targetId: { contains: params.search, mode: 'insensitive' } },
        { targetType: { contains: params.search, mode: 'insensitive' } },
        {
          actor: {
            email: { contains: params.search, mode: 'insensitive' },
          },
        },
      ];
    }

    return where;
  }

  // ---------------------------------------------------------------------------
  // Private — Server-side redaction (ENFORCED, not optional)
  // ---------------------------------------------------------------------------

  /**
   * Sanitize a log record by redacting sensitive fields in before/after/metadata.
   * This is the PRIMARY security boundary — no sensitive data must ever leave
   * the backend unredacted. UI masking is defense-in-depth only.
   */
  private sanitizeLog(log: any) {
    return {
      ...log,
      before: this.scrubSecrets(log.before),
      after: this.scrubSecrets(log.after),
      metadata: this.scrubSecrets(log.metadata),
    };
  }

  /**
   * Deep-traverse a JSON payload and replace sensitive field values.
   */
  private scrubSecrets(payload: any): any {
    if (!payload) return payload;

    let clean;
    try {
      clean = JSON.parse(JSON.stringify(payload));
    } catch {
      return payload;
    }

    const scrub = (obj: any) => {
      if (!obj || typeof obj !== 'object') return;

      for (const key of Object.keys(obj)) {
        if (SENSITIVE_KEYS.has(key.toLowerCase())) {
          obj[key] = '***REDACTED***';
        } else if (typeof obj[key] === 'object') {
          scrub(obj[key]);
        }
      }
    };

    scrub(clean);
    return clean;
  }
}
