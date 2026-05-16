import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AccessContext } from '../auth/interfaces/access-context.interface';
import { getRiskLevel, RISK_MAP } from './audit-risk.constants';
import {
  AdminSummaryDto,
  HighRiskEventDto,
  FailedActionDto,
  RoleChangeTimelineDto,
  CrossOrgAttemptDto,
  AuditInsightsResponseDto,
} from './dto/audit-insights.dto';

@Injectable()
export class AuditInsightsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Helper: Ensure date window doesn't exceed 30 days
   */
  private getValidDateRange(startDate?: Date, endDate?: Date) {
    const end = endDate || new Date();
    const start = startDate || new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000); // Default 30 days ago

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 30) {
      throw new BadRequestException('Date range cannot exceed 30 days');
    }

    return { start, end };
  }

  /**
   * Main dashboard insight aggregation
   */
  async getDashboardInsights(
    accessContext: AccessContext,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditInsightsResponseDto> {
    const { start, end } = this.getValidDateRange(startDate, endDate);

    // Build the base 'where' clause ensuring tenant isolation
    const baseWhere: any = {
      createdAt: { gte: start, lte: end },
    };

    if (!accessContext.isGlobalAccess && accessContext.targetOrganizationId) {
      // For tenant-scoped admins, filter logs where they are the actor OR the target is in their org
      // For simplicity in insights, we restrict to logs where target org matches their org if we had that field.
      // Since we don't have targetOrganizationId on the log table yet, we have to filter via relations
      // or assume the logs are globally accessible to the global admin.
      // If they are not global, we enforce isolation.
      // In a real scenario without targetOrganizationId on the log, this requires complex joins.
      // To prevent leaks, if not global, we'll only show logs where they are the actor.
      baseWhere.actorUserId = accessContext.actorUserId;
    }

    // Fetch raw logs needed for insights.
    // To prevent memory bloat, we don't fetch before/after/metadata unless strictly necessary.
    const logs = await this.prisma.auditLog.findMany({
      where: baseWhere,
      select: {
        id: true,
        action: true,
        targetType: true,
        targetId: true,
        result: true,
        createdAt: true,
        severity: true,
        tags: true,
        actor: {
          select: { id: true, email: true, firstName: true, lastName: true, organizationId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = this.buildSummary(logs, start, end);
    const highRiskEvents = this.buildHighRiskEvents(logs);
    const failedActions = this.buildFailedActions(logs);
    const roleChangeTimeline = this.buildRoleChangeTimeline(logs);
    const crossOrgAttempts = await this.buildCrossOrgAttempts(logs);
    const anomalies = this.buildAnomalies(logs);

    return {
      summary,
      highRiskEvents,
      failedActions,
      roleChangeTimeline,
      crossOrgAttempts,
      anomalies,
    };
  }

  private buildAnomalies(logs: any[]): HighRiskEventDto[] {
    return logs
      .filter((log) => log.severity === 'CRITICAL' || (log.tags && log.tags.includes('SPOOF_ATTEMPT')))
      .map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        actor: log.actor,
        action: log.action,
        target: { id: log.targetId, type: log.targetType },
        riskLevel: 'critical',
        reason: log.tags?.includes('SPOOF_ATTEMPT') ? 'Detected Spoofing Attempt' : 'Critical System Anomaly',
      }));
  }

  private buildSummary(logs: any[], start: Date, end: Date): AdminSummaryDto {
    const last24h = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    
    let roleChangesLast24h = 0;
    let failedAdminActions = 0;
    let newUsersCreated = 0;
    let deactivatedUsers = 0;
    let auditExports = 0;
    let criticalAnomalies = 0;
    let spoofAttempts = 0;

    for (const log of logs) {
      // Role changes last 24h
      if (
        (log.action === 'USER_ROLE_ASSIGNED' || log.action === 'USER_ROLE_REMOVED') &&
        log.createdAt >= last24h
      ) {
        roleChangesLast24h++;
      }

      // Failed admin actions
      if (log.result === 'failed') {
        failedAdminActions++;
      }

      if (log.action === 'USER_CREATED') newUsersCreated++;
      if (log.action === 'USER_DEACTIVATED') deactivatedUsers++;
      if (log.action === 'AUDIT_EXPORTED') auditExports++;

      // Anomalies
      if (log.severity === 'CRITICAL') criticalAnomalies++;
      if (log.tags && log.tags.includes('SPOOF_ATTEMPT')) spoofAttempts++;
    }

    return {
      roleChangesLast24h,
      failedAdminActions,
      newUsersCreated,
      deactivatedUsers,
      auditExports,
      criticalAnomalies,
      spoofAttempts,
    };
  }

  private buildHighRiskEvents(logs: any[]): HighRiskEventDto[] {
    const riskActions = Object.keys(RISK_MAP);
    
    return logs
      .filter((log) => riskActions.includes(log.action))
      .map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        actor: log.actor,
        action: log.action,
        target: { id: log.targetId, type: log.targetType },
        riskLevel: getRiskLevel(log.action),
        reason: log.result === 'failed' ? 'Action blocked by policy or permissions' : 'High-risk action executed',
      }));
  }

  private buildFailedActions(logs: any[]): FailedActionDto[] {
    return logs
      .filter((log) => log.result === 'failed')
      .map((log) => ({
        id: log.id,
        timestamp: log.createdAt,
        actor: log.actor,
        action: log.action,
        target: { id: log.targetId, type: log.targetType },
        reason: 'Action failed',
      }));
  }

  private buildRoleChangeTimeline(logs: any[]): RoleChangeTimelineDto[] {
    const roleLogs = logs.filter(
      (log) => log.action === 'USER_ROLE_ASSIGNED' || log.action === 'USER_ROLE_REMOVED',
    );

    // Group by target user ID
    const grouped = new Map<string, any[]>();
    for (const log of roleLogs) {
      if (log.targetType !== 'User') continue;
      if (!grouped.has(log.targetId)) {
        grouped.set(log.targetId, []);
      }
      grouped.get(log.targetId)!.push(log);
    }

    const timeline: RoleChangeTimelineDto[] = [];
    
    for (const [userId, userLogs] of grouped.entries()) {
      // Sort ASC for timeline readability
      userLogs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      
      timeline.push({
        targetUserId: userId,
        targetUserEmail: `User ID: ${userId}`, // We don't have the target user's email in the log directly without a join, but UI can resolve it if needed
        changes: userLogs.map((log) => ({
          action: log.action,
          assignedBy: log.actor,
          timestamp: log.createdAt,
        })),
      });
    }

    return timeline;
  }

  private async buildCrossOrgAttempts(logs: any[]): Promise<CrossOrgAttemptDto[]> {
    const attempts: CrossOrgAttemptDto[] = [];
    
    // We only care about logs where the actor HAS an organization.
    // System admins (organizationId = null) operate globally, so they can't have a cross-org mismatch.
    const relevantLogs = logs.filter((log) => log.actor && log.actor.organizationId);

    // Collect target IDs by type to batch fetch their organizations
    const targetIdsByType: Record<string, string[]> = {
      User: [],
      Supplier: [],
    };

    for (const log of relevantLogs) {
      if (targetIdsByType[log.targetType]) {
        targetIdsByType[log.targetType].push(log.targetId);
      }
    }

    // Resolve organizations targetType-aware
    const targetOrgs = new Map<string, string | null>();

    if (targetIdsByType['User'].length > 0) {
      const users = await this.prisma.user.findMany({
        where: { id: { in: targetIdsByType['User'] } },
        select: { id: true, organizationId: true },
      });
      for (const u of users) targetOrgs.set(`User:${u.id}`, u.organizationId);
    }

    if (targetIdsByType['Supplier'].length > 0) {
      const suppliers = await this.prisma.supplier.findMany({
        where: { id: { in: targetIdsByType['Supplier'] } },
        select: { id: true, organizationId: true },
      });
      for (const s of suppliers) targetOrgs.set(`Supplier:${s.id}`, s.organizationId);
    }

    // Now evaluate cross-org attempts
    for (const log of relevantLogs) {
      const targetOrgId = targetOrgs.get(`${log.targetType}:${log.targetId}`);
      
      // RULE: If target org cannot be resolved -> do NOT classify as cross-org (prevent false positives)
      if (!targetOrgId) continue;

      if (log.actor.organizationId !== targetOrgId) {
        attempts.push({
          id: log.id,
          timestamp: log.createdAt,
          actor: log.actor,
          action: log.action,
          target: { id: log.targetId, type: log.targetType },
          result: log.result as 'success' | 'failed',
        });
      }
    }

    return attempts;
  }
}
