import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import {
  AuditLogQueryDto,
  AuditLogEntryDto,
  AuditLogListResponseDto,
  ChangeHistoryQueryDto,
  ChangeHistoryResponseDto,
  FieldChangeDto,
  ComplianceReportQueryDto,
  ComplianceReportType,
  UserAccessReportDto,
  DataChangesReportDto,
  PayrunHistoryReportDto,
  SensitiveDataAccessReportDto,
  ApprovalAuditReportDto,
  RetentionStatusReportDto,
  RetentionPolicyDto,
  CreateRetentionPolicyDto,
  UpdateRetentionPolicyDto,
  DataExportRequestDto,
  DataExportResultDto,
  EntityType,
  AuditAction,
  RetentionPeriod,
  FIELD_LABELS,
  SENSITIVE_FIELDS,
} from './dto/compliance.dto';
import { format, subDays, differenceInHours } from 'date-fns';

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // Audit Log Queries
  // ============================================================================

  async getAuditLogs(query: AuditLogQueryDto): Promise<AuditLogListResponseDto> {
    const where: any = {};

    if (query.user_id) {
      where.userId = query.user_id;
    }
    if (query.entity_type) {
      where.entityType = query.entity_type;
    }
    if (query.entity_id) {
      where.entityId = query.entity_id;
    }
    if (query.action) {
      where.action = query.action;
    }
    if (query.from_date) {
      where.createdAt = { gte: new Date(query.from_date) };
    }
    if (query.to_date) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.to_date) };
    }
    if (query.search) {
      where.OR = [
        { entityId: { contains: query.search, mode: 'insensitive' } },
        { reason: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const limit = query.limit || 50;
    const offset = query.offset || 0;

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        skip: offset,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    const hasMore = logs.length > limit;
    const resultLogs = hasMore ? logs.slice(0, limit) : logs;

    return {
      logs: resultLogs.map((log: any) => this.mapAuditLog(log)),
      total,
      has_more: hasMore,
    };
  }

  async getChangeHistory(query: ChangeHistoryQueryDto): Promise<ChangeHistoryResponseDto> {
    const where: any = {
      entityType: query.entity_type,
      entityId: query.entity_id,
      action: { in: ['CREATE', 'UPDATE', 'DELETE'] },
    };

    if (query.from_date) {
      where.createdAt = { gte: new Date(query.from_date) };
    }
    if (query.to_date) {
      where.createdAt = { ...where.createdAt, lte: new Date(query.to_date) };
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Get entity description
    const entityDescription = await this.getEntityDescription(query.entity_type, query.entity_id);

    // Find creation and last modification
    const createLog = logs.find((l: any) => l.action === 'CREATE');
    const lastModifyLog = logs.find((l: any) => l.action === 'UPDATE') || createLog;

    // Filter by specific field if requested
    let filteredLogs = logs;
    if (query.field) {
      filteredLogs = logs.filter((log: any) => {
        const oldValue = log.oldValue as Record<string, any> | null;
        const newValue = log.newValue as Record<string, any> | null;
        return (
          (oldValue && query.field! in oldValue) ||
          (newValue && query.field! in newValue)
        );
      });
    }

    return {
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      entity_description: entityDescription,
      created_at: createLog?.createdAt.toISOString() || '',
      created_by: createLog?.user ? `${createLog.user.firstName} ${createLog.user.lastName}` : undefined,
      last_modified_at: lastModifyLog?.createdAt.toISOString() || '',
      last_modified_by: lastModifyLog?.user ? `${lastModifyLog.user.firstName} ${lastModifyLog.user.lastName}` : undefined,
      total_changes: filteredLogs.length,
      changes: filteredLogs.map((log: any) => this.mapAuditLog(log)),
    };
  }

  // ============================================================================
  // Compliance Reports
  // ============================================================================

  async generateComplianceReport(query: ComplianceReportQueryDto): Promise<any> {
    const fromDate = query.from_date ? new Date(query.from_date) : subDays(new Date(), 30);
    const toDate = query.to_date ? new Date(query.to_date) : new Date();

    switch (query.report_type) {
      case ComplianceReportType.USER_ACCESS:
        return this.generateUserAccessReport(fromDate, toDate);
      case ComplianceReportType.DATA_CHANGES:
        return this.generateDataChangesReport(fromDate, toDate, query.user_id);
      case ComplianceReportType.PAYRUN_HISTORY:
        return this.generatePayrunHistoryReport(fromDate, toDate, query.legal_entity_id);
      case ComplianceReportType.SENSITIVE_DATA_ACCESS:
        return this.generateSensitiveDataAccessReport(fromDate, toDate);
      case ComplianceReportType.APPROVAL_AUDIT:
        return this.generateApprovalAuditReport(fromDate, toDate);
      case ComplianceReportType.RETENTION_STATUS:
        return this.generateRetentionStatusReport();
      default:
        throw new NotFoundException(`Unknown report type: ${query.report_type}`);
    }
  }

  private async generateUserAccessReport(fromDate: Date, toDate: Date): Promise<UserAccessReportDto> {
    const users = await this.prisma.user.findMany({
      include: {
        roleAssignments: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        auditLogs: {
          where: {
            action: { in: ['LOGIN', 'FAILED_LOGIN'] },
            createdAt: { gte: fromDate, lte: toDate },
          },
        },
      },
    });

    const userStats = users.map((user: any) => {
      const logins = user.auditLogs.filter((l: any) => l.action === 'LOGIN');
      const failedLogins = user.auditLogs.filter((l: any) => l.action === 'FAILED_LOGIN');
      const lastLogin = logins.length > 0 ? logins[0].createdAt : null;

      return {
        user_id: user.id,
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        roles: user.roleAssignments.map((ra: any) => ra.role.name),
        last_login: lastLogin ? format(lastLogin, 'yyyy-MM-dd HH:mm:ss') : undefined,
        login_count: logins.length,
        failed_login_count: failedLogins.length,
        permissions: user.roleAssignments.flatMap((ra: any) => ra.role.permissions || []),
      };
    });

    const totalLogins = userStats.reduce((s: number, u: any) => s + u.login_count, 0);
    const failedLogins = userStats.reduce((s: number, u: any) => s + u.failed_login_count, 0);
    const activeUsers = userStats.filter((u: any) => u.login_count > 0).length;

    return {
      report_type: 'USER_ACCESS',
      generated_at: new Date().toISOString(),
      period_start: format(fromDate, 'yyyy-MM-dd'),
      period_end: format(toDate, 'yyyy-MM-dd'),
      total_users: users.length,
      active_users: activeUsers,
      total_logins: totalLogins,
      failed_logins: failedLogins,
      users: userStats,
    };
  }

  private async generateDataChangesReport(
    fromDate: Date,
    toDate: Date,
    userId?: string,
  ): Promise<DataChangesReportDto> {
    const where: any = {
      action: { in: ['CREATE', 'UPDATE', 'DELETE'] },
      createdAt: { gte: fromDate, lte: toDate },
    };

    if (userId) {
      where.userId = userId;
    }

    const logs = await this.prisma.auditLog.findMany({
      where,
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by entity type
    const byEntityType = new Map<string, { count: number; creates: number; updates: number; deletes: number }>();
    const byUser = new Map<string, { name: string; count: number }>();
    const sensitiveChanges: any[] = [];

    for (const log of logs) {
      // By entity type
      const entityStats = byEntityType.get(log.entityType) || { count: 0, creates: 0, updates: 0, deletes: 0 };
      entityStats.count++;
      if (log.action === 'CREATE') entityStats.creates++;
      if (log.action === 'UPDATE') entityStats.updates++;
      if (log.action === 'DELETE') entityStats.deletes++;
      byEntityType.set(log.entityType, entityStats);

      // By user
      if (log.userId) {
        const userName = (log as any).user ? `${(log as any).user.firstName} ${(log as any).user.lastName}` : 'Unknown';
        const userStats = byUser.get(log.userId) || { name: userName, count: 0 };
        userStats.count++;
        byUser.set(log.userId, userStats);
      }

      // Check for sensitive field changes
      if (this.hasSensitiveFieldChanges(log.oldValue as any, log.newValue as any)) {
        sensitiveChanges.push(this.mapAuditLog(log));
      }
    }

    return {
      report_type: 'DATA_CHANGES',
      generated_at: new Date().toISOString(),
      period_start: format(fromDate, 'yyyy-MM-dd'),
      period_end: format(toDate, 'yyyy-MM-dd'),
      total_changes: logs.length,
      by_entity_type: Array.from(byEntityType.entries()).map(([type, stats]) => ({
        entity_type: type as EntityType,
        ...stats,
      })),
      by_user: Array.from(byUser.entries()).map(([userId, stats]) => ({
        user_id: userId,
        user_name: stats.name,
        total_changes: stats.count,
      })),
      sensitive_changes: sensitiveChanges.slice(0, 100),
    };
  }

  private async generatePayrunHistoryReport(
    fromDate: Date,
    toDate: Date,
    legalEntityId?: string,
  ): Promise<PayrunHistoryReportDto> {
    const where: any = {
      createdAt: { gte: fromDate, lte: toDate },
    };

    if (legalEntityId) {
      where.payGroup = { legalEntityId };
    }

    const payruns = await this.prisma.payRun.findMany({
      where,
      include: {
        payGroup: { include: { legalEntity: true } },
        employeeResults: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const payrunDetails = await Promise.all(
      payruns.map(async (payrun: any) => {
        // Get audit logs for this payrun
        const logs = await this.prisma.auditLog.findMany({
          where: { entityType: 'PayRun', entityId: payrun.id },
          include: { user: { select: { firstName: true, lastName: true } } },
          orderBy: { createdAt: 'asc' },
        });

        // Extract state changes
        const stateChanges = logs
          .filter((l: any) => l.action === 'UPDATE' && (l.newValue as any)?.status)
          .map((l: any) => ({
            from_status: (l.oldValue as any)?.status || 'UNKNOWN',
            to_status: (l.newValue as any)?.status,
            changed_at: format(l.createdAt, 'yyyy-MM-dd HH:mm:ss'),
            changed_by: l.user ? `${l.user.firstName} ${l.user.lastName}` : undefined,
            reason: l.reason || undefined,
          }));

        const totalGross = payrun.employeeResults.reduce((s: number, r: any) => s + Number(r.gross), 0);
        const totalNet = payrun.employeeResults.reduce((s: number, r: any) => s + Number(r.net), 0);

        const createLog = logs.find((l: any) => l.action === 'CREATE');
        const calcLog = logs.find((l: any) => (l.newValue as any)?.status === 'CALCULATED');
        const approveLog = logs.find((l: any) => (l.newValue as any)?.status === 'APPROVED');
        const finalizeLog = logs.find((l: any) => (l.newValue as any)?.status === 'FINALIZED');

        return {
          payrun_id: payrun.id,
          pay_group_name: payrun.payGroup.name,
          period: `${format(payrun.periodStart, 'yyyy-MM-dd')} to ${format(payrun.periodEnd, 'yyyy-MM-dd')}`,
          status: payrun.status,
          created_at: format(payrun.createdAt, 'yyyy-MM-dd HH:mm:ss'),
          created_by: createLog?.user ? `${createLog.user.firstName} ${createLog.user.lastName}` : undefined,
          calculated_at: calcLog ? format(calcLog.createdAt, 'yyyy-MM-dd HH:mm:ss') : undefined,
          calculated_by: calcLog?.user ? `${calcLog.user.firstName} ${calcLog.user.lastName}` : undefined,
          approved_at: approveLog ? format(approveLog.createdAt, 'yyyy-MM-dd HH:mm:ss') : undefined,
          approved_by: approveLog?.user ? `${approveLog.user.firstName} ${approveLog.user.lastName}` : undefined,
          finalized_at: finalizeLog ? format(finalizeLog.createdAt, 'yyyy-MM-dd HH:mm:ss') : undefined,
          finalized_by: finalizeLog?.user ? `${finalizeLog.user.firstName} ${finalizeLog.user.lastName}` : undefined,
          total_gross: Math.round(totalGross * 100) / 100,
          total_net: Math.round(totalNet * 100) / 100,
          employee_count: payrun.employeeResults.length,
          state_changes: stateChanges,
        };
      }),
    );

    return {
      report_type: 'PAYRUN_HISTORY',
      generated_at: new Date().toISOString(),
      period_start: format(fromDate, 'yyyy-MM-dd'),
      period_end: format(toDate, 'yyyy-MM-dd'),
      total_payruns: payruns.length,
      payruns: payrunDetails,
    };
  }

  private async generateSensitiveDataAccessReport(
    fromDate: Date,
    toDate: Date,
  ): Promise<SensitiveDataAccessReportDto> {
    const sensitiveEntityTypes = ['BANK_ACCOUNT', 'TAX_PROFILE', 'COMPENSATION'];
    const sensitiveActions = ['VIEW', 'EXPORT', 'UPDATE'];

    const logs = await this.prisma.auditLog.findMany({
      where: {
        entityType: { in: sensitiveEntityTypes },
        action: { in: sensitiveActions },
        createdAt: { gte: fromDate, lte: toDate },
      },
      include: { user: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // Aggregate by data type
    const byDataType = new Map<string, { access: number; export: number }>();

    for (const log of logs) {
      const stats = byDataType.get(log.entityType) || { access: 0, export: 0 };
      if (log.action === 'EXPORT') {
        stats.export++;
      } else {
        stats.access++;
      }
      byDataType.set(log.entityType, stats);
    }

    return {
      report_type: 'SENSITIVE_DATA_ACCESS',
      generated_at: new Date().toISOString(),
      period_start: format(fromDate, 'yyyy-MM-dd'),
      period_end: format(toDate, 'yyyy-MM-dd'),
      total_accesses: logs.length,
      by_data_type: Array.from(byDataType.entries()).map(([type, stats]) => ({
        data_type: type,
        access_count: stats.access,
        export_count: stats.export,
      })),
      accesses: logs.slice(0, 200).map((log: any) => ({
        timestamp: format(log.createdAt, 'yyyy-MM-dd HH:mm:ss'),
        user_id: log.userId || '',
        user_name: log.user ? `${log.user.firstName} ${log.user.lastName}` : 'System',
        data_type: log.entityType,
        action: log.action,
        entity_id: log.entityId,
        ip_address: (log.metadata as any)?.ip_address,
      })),
    };
  }

  private async generateApprovalAuditReport(
    fromDate: Date,
    toDate: Date,
  ): Promise<ApprovalAuditReportDto> {
    const instances = await this.prisma.approvalInstance.findMany({
      where: { submittedAt: { gte: fromDate, lte: toDate } },
      include: {
        submitter: { select: { firstName: true, lastName: true } },
        steps: {
          include: { actor: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    let totalApproved = 0;
    let totalRejected = 0;
    let totalPending = 0;
    let totalApprovalTime = 0;
    let completedCount = 0;

    const byApprover = new Map<string, { name: string; approved: number; rejected: number; totalTime: number; count: number }>();

    for (const instance of instances) {
      if (instance.isCancelled) continue;

      const isApproved = instance.steps.every(step => step.status === 'APPROVED');
      const isRejected = instance.steps.some((s: any) => s.status === 'REJECTED');
      const isPending = !isApproved && !isRejected;

      if (isApproved) totalApproved++;
      else if (isRejected) totalRejected++;
      else totalPending++;

      // Calculate approval time
      const completedSteps = instance.steps.filter((s: any) => s.actedAt);
      if (completedSteps.length > 0) {
        const lastStep = completedSteps[completedSteps.length - 1];
        if (!lastStep.actedAt || !instance.submittedAt) continue;
        const approvalTime = differenceInHours(lastStep.actedAt, instance.submittedAt);
        totalApprovalTime += approvalTime;
        completedCount++;
      }

      // Track by approver
      for (const step of instance.steps) {
        if (step.actedAt && step.actedBy) {
          const stats = byApprover.get(step.actedBy) || {
            name: (step as any).actor ? `${(step as any).actor.firstName} ${(step as any).actor.lastName}` : 'Unknown',
            approved: 0,
            rejected: 0,
            totalTime: 0,
            count: 0,
          };

          if (step.status === 'APPROVED') stats.approved++;
          else if (step.status === 'REJECTED') stats.rejected++;

          stats.totalTime += differenceInHours(step.actedAt, step.createdAt);
          stats.count++;

          byApprover.set(step.actedBy, stats);
        }
      }
    }

    return {
      report_type: 'APPROVAL_AUDIT',
      generated_at: new Date().toISOString(),
      period_start: format(fromDate, 'yyyy-MM-dd'),
      period_end: format(toDate, 'yyyy-MM-dd'),
      total_approvals: instances.length,
      approved: totalApproved,
      rejected: totalRejected,
      pending: totalPending,
      average_approval_time_hours: completedCount > 0 ? Math.round(totalApprovalTime / completedCount) : 0,
      by_approver: Array.from(byApprover.entries()).map(([userId, stats]) => ({
        user_id: userId,
        user_name: stats.name,
        approved: stats.approved,
        rejected: stats.rejected,
        avg_time_hours: stats.count > 0 ? Math.round(stats.totalTime / stats.count) : 0,
      })),
      approvals: instances.slice(0, 100).map((inst: any) => ({
        entity_type: inst.entityType,
        entity_id: inst.entityId,
        submitted_at: format(inst.submittedAt, 'yyyy-MM-dd HH:mm:ss'),
        submitted_by: `${inst.submitter.firstName} ${inst.submitter.lastName}`,
        status: inst.steps.every((s: any) => s.status === 'APPROVED') ? 'APPROVED' : inst.isCancelled ? 'CANCELLED' : 'PENDING',
        completed_at: inst.steps.find((s: any) => s.actedAt)?.actedAt
          ? format(inst.steps.find((s: any) => s.actedAt).actedAt, 'yyyy-MM-dd HH:mm:ss')
          : undefined,
        levels: inst.steps.map((s: any) => ({
          level: s.levelOrder,
          approver: s.actor ? `${s.actor.firstName} ${s.actor.lastName}` : 'Pending',
          action: s.status,
          acted_at: s.actedAt ? format(s.actedAt, 'yyyy-MM-dd HH:mm:ss') : undefined,
          comment: s.comment,
        })),
      })),
    };
  }

  private async generateRetentionStatusReport(): Promise<RetentionStatusReportDto> {
    const policies = await this.getRetentionPolicies();

    // Get data summary for each entity type
    const entityTypes: EntityType[] = [
      EntityType.EMPLOYEE,
      EntityType.PAYRUN,
      EntityType.BANK_ACCOUNT,
      EntityType.COMPENSATION,
    ];

    const dataSummary = await Promise.all(
      entityTypes.map(async (entityType) => {
        const policy = policies.find((p) => p.entity_type === entityType);
        const tableName = this.getTableName(entityType);

        try {
          const count = await (this.prisma as any)[tableName].count();
          const oldest = await (this.prisma as any)[tableName].findFirst({
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          });
          const newest = await (this.prisma as any)[tableName].findFirst({
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true },
          });

          return {
            entity_type: entityType,
            total_records: count,
            oldest_record: oldest?.createdAt ? format(oldest.createdAt, 'yyyy-MM-dd') : 'N/A',
            newest_record: newest?.createdAt ? format(newest.createdAt, 'yyyy-MM-dd') : 'N/A',
            records_due_for_deletion: 0, // Would calculate based on policy
            retention_policy: policy?.retention_period || RetentionPeriod.YEARS_7,
          };
        } catch {
          return {
            entity_type: entityType,
            total_records: 0,
            oldest_record: 'N/A',
            newest_record: 'N/A',
            records_due_for_deletion: 0,
            retention_policy: RetentionPeriod.YEARS_7,
          };
        }
      }),
    );

    return {
      report_type: 'RETENTION_STATUS',
      generated_at: new Date().toISOString(),
      policies,
      data_summary: dataSummary,
      upcoming_deletions: [], // Would be calculated based on retention policies
    };
  }

  // ============================================================================
  // Retention Policies
  // ============================================================================

  async getRetentionPolicies(): Promise<RetentionPolicyDto[]> {
    // Default policies (in production, these would be stored in DB)
    return [
      {
        id: 'pol-1',
        entity_type: EntityType.EMPLOYEE,
        retention_period: RetentionPeriod.YEARS_7,
        description: 'Employee records must be retained for 7 years after termination',
        is_active: true,
        legal_requirement: 'BCEA, Income Tax Act',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pol-2',
        entity_type: EntityType.PAYRUN,
        retention_period: RetentionPeriod.YEARS_5,
        description: 'Payroll records must be retained for 5 years',
        is_active: true,
        legal_requirement: 'Income Tax Act',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'pol-3',
        entity_type: EntityType.BANK_ACCOUNT,
        retention_period: RetentionPeriod.YEARS_5,
        description: 'Banking records retained for 5 years',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];
  }

  // ============================================================================
  // Data Export (POPIA Compliance)
  // ============================================================================

  async requestDataExport(dto: DataExportRequestDto, userId: string): Promise<DataExportResultDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employee_id },
      include: {
        employments: true,
        compensations: true,
        bankAccounts: true,
        taxProfiles: true,
        employeeResults: { take: 12 },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employee_id} not found`);
    }

    // Log the export request
    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'EXPORT',
        entityType: 'Employee',
        entityId: dto.employee_id,
        newValue: { reason: dto.reason, include_types: dto.include_types },
      },
    });

    const includedData: { type: EntityType; record_count: number }[] = [
      { type: EntityType.EMPLOYEE, record_count: 1 },
      { type: EntityType.EMPLOYMENT, record_count: employee.employments.length },
      { type: EntityType.COMPENSATION, record_count: employee.compensations.length },
      { type: EntityType.BANK_ACCOUNT, record_count: employee.bankAccounts.length },
      { type: EntityType.TAX_PROFILE, record_count: employee.taxProfiles.length },
      { type: EntityType.PAYRUN, record_count: employee.employeeResults.length },
    ];

    return {
      request_id: `export-${Date.now()}`,
      employee_id: dto.employee_id,
      employee_name: `${employee.firstName} ${employee.lastName}`,
      requested_at: new Date().toISOString(),
      requested_by: userId,
      status: 'COMPLETED',
      included_data: includedData.filter((d) => d.record_count > 0),
    };
  }

  // ============================================================================
  // Helpers
  // ============================================================================

  private mapAuditLog(log: any): AuditLogEntryDto {
    const changes = this.calculateFieldChanges(log.oldValue, log.newValue);

    return {
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      user_id: log.userId,
      user_email: log.user?.email,
      user_name: log.user ? `${log.user.firstName} ${log.user.lastName}` : undefined,
      action: log.action as AuditAction,
      entity_type: log.entityType as EntityType,
      entity_id: log.entityId,
      old_value: log.oldValue as Record<string, any>,
      new_value: log.newValue as Record<string, any>,
      changes,
      reason: log.reason,
      metadata: log.metadata as Record<string, any>,
    };
  }

  private calculateFieldChanges(oldValue: any, newValue: any): FieldChangeDto[] {
    if (!oldValue && !newValue) return [];

    const changes: FieldChangeDto[] = [];
    const allKeys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]);

    for (const key of allKeys) {
      const oldVal = oldValue?.[key];
      const newVal = newValue?.[key];

      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        let changeType: 'added' | 'modified' | 'removed';
        if (oldVal === undefined) changeType = 'added';
        else if (newVal === undefined) changeType = 'removed';
        else changeType = 'modified';

        changes.push({
          field: key,
          field_label: FIELD_LABELS[key] || key,
          old_value: oldVal,
          new_value: newVal,
          change_type: changeType,
        });
      }
    }

    return changes;
  }

  private hasSensitiveFieldChanges(oldValue: any, newValue: any): boolean {
    if (!oldValue && !newValue) return false;
    const allKeys = new Set([...Object.keys(oldValue || {}), ...Object.keys(newValue || {})]);
    return SENSITIVE_FIELDS.some((field) => allKeys.has(field));
  }

  private async getEntityDescription(entityType: EntityType, entityId: string): Promise<string> {
    try {
      switch (entityType) {
        case EntityType.EMPLOYEE: {
          const emp = await this.prisma.employee.findUnique({ where: { id: entityId } });
          return emp ? `${emp.firstName} ${emp.lastName} (${emp.employeeNo})` : entityId;
        }
        case EntityType.PAYRUN: {
          const payrun = await this.prisma.payRun.findUnique({
            where: { id: entityId },
            include: { payGroup: true },
          });
          return payrun && payrun.periodEnd ? `${payrun.payGroup.name} - ${format(payrun.periodEnd, 'MMM yyyy')}` : entityId;
        }
        default:
          return entityId;
      }
    } catch {
      return entityId;
    }
  }

  private getTableName(entityType: EntityType): string {
    const mapping: Record<EntityType, string> = {
      [EntityType.USER]: 'user',
      [EntityType.EMPLOYEE]: 'employee',
      [EntityType.EMPLOYMENT]: 'employment',
      [EntityType.COMPENSATION]: 'compensation',
      [EntityType.BANK_ACCOUNT]: 'bankAccount',
      [EntityType.TAX_PROFILE]: 'taxProfile',
      [EntityType.PAY_ITEM]: 'payItem',
      [EntityType.PAY_GROUP]: 'payGroup',
      [EntityType.LEGAL_ENTITY]: 'legalEntity',
      [EntityType.PAYRUN]: 'payRun',
      [EntityType.APPROVAL]: 'approvalInstance',
      [EntityType.CHANGE_REQUEST]: 'changeRequest',
      [EntityType.REPORT]: 'artifact',
      [EntityType.EXPORT]: 'artifact',
      [EntityType.SYSTEM]: 'auditLog',
    };
    return mapping[entityType] || 'auditLog';
  }
}
