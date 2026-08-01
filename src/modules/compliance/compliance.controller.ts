import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import {
  AuditLogQueryDto,
  AuditLogListResponseDto,
  ChangeHistoryQueryDto,
  ChangeHistoryResponseDto,
  ComplianceReportQueryDto,
  RetentionPolicyDto,
  DataExportRequestDto,
  DataExportResultDto,
} from './dto/compliance.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('compliance')
export class ComplianceController {
  constructor(private readonly complianceService: ComplianceService) {}

  // ============================================================================
  // Audit Logs
  // ============================================================================

  @Get('audit-logs')
  @Permissions('audit:read')
  async getAuditLogs(@Query() query: AuditLogQueryDto): Promise<AuditLogListResponseDto> {
    return this.complianceService.getAuditLogs(query);
  }

  @Get('audit-logs/entity/:entityType/:entityId')
  @Permissions('audit:read')
  async getEntityAuditLogs(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: AuditLogQueryDto,
  ): Promise<AuditLogListResponseDto> {
    return this.complianceService.getAuditLogs({
      ...query,
      entity_type: entityType as any,
      entity_id: entityId,
    });
  }

  // ============================================================================
  // Change History
  // ============================================================================

  @Get('change-history')
  @Permissions('audit:read')
  async getChangeHistory(@Query() query: ChangeHistoryQueryDto): Promise<ChangeHistoryResponseDto> {
    return this.complianceService.getChangeHistory(query);
  }

  @Get('change-history/:entityType/:entityId')
  @Permissions('audit:read')
  async getEntityChangeHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('field') field?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ): Promise<ChangeHistoryResponseDto> {
    return this.complianceService.getChangeHistory({
      entity_type: entityType as any,
      entity_id: entityId,
      field,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  // ============================================================================
  // Compliance Reports
  // ============================================================================

  @Get('reports')
  @Permissions('compliance:read')
  async getComplianceReport(@Query() query: ComplianceReportQueryDto): Promise<any> {
    return this.complianceService.generateComplianceReport(query);
  }

  @Get('reports/user-access')
  @Permissions('compliance:read')
  async getUserAccessReport(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ): Promise<any> {
    return this.complianceService.generateComplianceReport({
      report_type: 'USER_ACCESS' as any,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  @Get('reports/data-changes')
  @Permissions('compliance:read')
  async getDataChangesReport(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('user_id') userId?: string,
  ): Promise<any> {
    return this.complianceService.generateComplianceReport({
      report_type: 'DATA_CHANGES' as any,
      from_date: fromDate,
      to_date: toDate,
      user_id: userId,
    });
  }

  @Get('reports/payrun-history')
  @Permissions('compliance:read')
  async getPayrunHistoryReport(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('legal_entity_id') legalEntityId?: string,
  ): Promise<any> {
    return this.complianceService.generateComplianceReport({
      report_type: 'PAYRUN_HISTORY' as any,
      from_date: fromDate,
      to_date: toDate,
      legal_entity_id: legalEntityId,
    });
  }

  @Get('reports/sensitive-data')
  @Permissions('compliance:read')
  async getSensitiveDataReport(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ): Promise<any> {
    return this.complianceService.generateComplianceReport({
      report_type: 'SENSITIVE_DATA_ACCESS' as any,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  @Get('reports/approval-audit')
  @Permissions('compliance:read')
  async getApprovalAuditReport(
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ): Promise<any> {
    return this.complianceService.generateComplianceReport({
      report_type: 'APPROVAL_AUDIT' as any,
      from_date: fromDate,
      to_date: toDate,
    });
  }

  // ============================================================================
  // Retention Policies
  // ============================================================================

  @Get('retention-policies')
  @Permissions('compliance:read')
  async getRetentionPolicies(): Promise<RetentionPolicyDto[]> {
    return this.complianceService.getRetentionPolicies();
  }

  @Get('retention-status')
  @Permissions('compliance:read')
  async getRetentionStatus(): Promise<any> {
    return this.complianceService.generateComplianceReport({
      report_type: 'RETENTION_STATUS' as any,
    });
  }

  // ============================================================================
  // Data Subject Requests (POPIA/GDPR)
  // ============================================================================

  @Post('data-export')
  @HttpCode(HttpStatus.OK)
  @Permissions('compliance:export')
  async requestDataExport(
    @Body() dto: DataExportRequestDto,
    @CurrentUser('sub') userId: string,
  ): Promise<DataExportResultDto> {
    return this.complianceService.requestDataExport(dto, userId);
  }
}
