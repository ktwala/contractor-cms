import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../core/auth/guards/permissions.guard';
import { Permissions } from '../../core/auth/decorators/permissions.decorator';
import { RequiresOrgContext } from '../../core/auth/decorators/org-context.decorator';
import { CurrentAccessContext } from '../../core/auth/decorators/current-access-context.decorator';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { PERMISSIONS } from '../../core/auth/permissions.constants';
import { SourceIntegrationService } from '../../integration/source-integration.service';
import { DemoSupplierSetupService } from '../demo/demo-supplier-setup.service';
import { DemoMtnStorySetupService } from '../demo/demo-mtn-story-setup.service';
import { DemoSupplierSetupResponseDto } from '../demo/dto/demo-supplier-setup-response.dto';
import { DemoMtnStorySetupResponseDto } from '../demo/dto/demo-mtn-story-setup-response.dto';
import { OracleSupplierImportDto } from './dto/oracle-supplier-import.dto';
import { QueryOracleStagingDto } from './dto/query-oracle-staging.dto';
import {
  OracleImportResponseDto,
  PaginatedOracleStagingResponseDto,
} from './dto/oracle-staging-response.dto';
import { PromoteOracleStagingDto } from './dto/promote-oracle-staging.dto';
import {
  GovernanceTwinPromotionResultDto,
  PromoteOracleStagingBatchResponseDto,
} from './dto/governance-twin-promotion-response.dto';
import { OracleConnectorHealthResponseDto } from './dto/oracle-connector-health.dto';
import { OracleConnectorTelemetryResponseDto } from './dto/oracle-connector-telemetry.dto';
import { OracleConnectorOperationsDashboardDto } from './dto/oracle-connector-operations-dashboard.dto';
import {
  OracleConnectorAnomaliesResponseDto,
  PaginatedOracleSyncRunsResponseDto,
} from './dto/oracle-connector-anomalies.dto';
import { QueryOracleSyncRunsDto } from './dto/query-oracle-sync-runs.dto';
import {
  AssignSupplierSourceDriftDto,
  DetectSupplierSourceDriftResponseDto,
  PaginatedSupplierSourceDriftResponseDto,
  QuerySupplierSourceDriftDto,
  ResolveSupplierSourceDriftDto,
  SupplierSourceDriftItemDto,
} from './dto/supplier-source-drift.dto';

@ApiTags('supplier-sources')
@Controller('supplier-sources/oracle')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OracleSupplierImportController {
  constructor(
    private readonly sourceIntegration: SourceIntegrationService,
    private readonly demoSupplierSetup: DemoSupplierSetupService,
    private readonly demoMtnStorySetup: DemoMtnStorySetupService,
  ) {}

  @Get('health')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Oracle Procurement connector health (includes stale detection; does not run sync)',
  })
  @ApiResponse({ status: 200, type: OracleConnectorHealthResponseDto })
  async getConnectorHealth(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<OracleConnectorHealthResponseDto> {
    return this.sourceIntegration.getOracleConnectorHealth(accessContext);
  }

  @Get('telemetry')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Oracle connector telemetry (derived from sync-run ledger and staging)',
  })
  @ApiResponse({ status: 200, type: OracleConnectorTelemetryResponseDto })
  async getConnectorTelemetry(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<OracleConnectorTelemetryResponseDto> {
    return this.sourceIntegration.getOracleConnectorTelemetry(accessContext);
  }

  @Get('dashboard')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Oracle connector operations dashboard (health, sync, governance, anomalies)',
  })
  @ApiResponse({ status: 200, type: OracleConnectorOperationsDashboardDto })
  async getOperationsDashboard(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<OracleConnectorOperationsDashboardDto> {
    return this.sourceIntegration.getOracleConnectorDashboard(accessContext);
  }

  @Get('sync-runs')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Paginated Oracle connector sync-run history' })
  @ApiResponse({ status: 200, type: PaginatedOracleSyncRunsResponseDto })
  async listSyncRuns(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryOracleSyncRunsDto,
  ): Promise<PaginatedOracleSyncRunsResponseDto> {
    return this.sourceIntegration.listOracleSyncRuns(accessContext, query);
  }

  @Get('anomalies')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Oracle connector reconciliation and drift anomalies',
  })
  @ApiResponse({ status: 200, type: OracleConnectorAnomaliesResponseDto })
  async getAnomalies(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<OracleConnectorAnomaliesResponseDto> {
    return this.sourceIntegration.getOracleConnectorAnomalies(accessContext);
  }

  @Get('reconciliation-work-items')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'HCM-observed supplier references awaiting reconciliation with Supplier Portal',
  })
  async listReconciliationWorkItems(
    @CurrentAccessContext() accessContext: AccessContext,
  ) {
    return this.sourceIntegration.listSupplierReconciliationWorkItems(accessContext);
  }

  @Get('drift')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'List governed source drift records' })
  @ApiResponse({ status: 200, type: PaginatedSupplierSourceDriftResponseDto })
  async listDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QuerySupplierSourceDriftDto,
  ): Promise<PaginatedSupplierSourceDriftResponseDto> {
    return this.sourceIntegration.listOracleSourceDrift(accessContext, query);
  }

  @Get('drift/summary')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Drift severity summary for operations dashboard' })
  async getDriftSummary(@CurrentAccessContext() accessContext: AccessContext) {
    return this.sourceIntegration.getOracleSourceDriftSummary(accessContext);
  }

  @Post('drift/detect')
  @Permissions(PERMISSIONS.SUPPLIERS.GOVERNANCE_SCAN)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Run drift detection for organization (no auto-remediation)',
  })
  @ApiResponse({ status: 201, type: DetectSupplierSourceDriftResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'Assessment blocked — synchronization not complete or latest snapshot already assessed',
  })
  async detectDrift(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<DetectSupplierSourceDriftResponseDto> {
    return this.sourceIntegration.detectOracleSourceDrift(accessContext);
  }

  @Get('drift/:driftId')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: SupplierSourceDriftItemDto })
  async getDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('driftId') driftId: string,
  ): Promise<SupplierSourceDriftItemDto> {
    return this.sourceIntegration.getOracleSourceDrift(accessContext, driftId);
  }

  @Post('drift/:driftId/assign')
  @Permissions(PERMISSIONS.SUPPLIERS.GOVERNANCE_SCAN)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: SupplierSourceDriftItemDto })
  async assignDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('driftId') driftId: string,
    @Body() dto: AssignSupplierSourceDriftDto,
  ): Promise<SupplierSourceDriftItemDto> {
    return this.sourceIntegration.assignOracleSourceDrift(
      accessContext,
      driftId,
      dto.assignedToUserId,
    );
  }

  @Post('drift/:driftId/resolve')
  @Permissions(PERMISSIONS.SUPPLIERS.GOVERNANCE_SCAN)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: SupplierSourceDriftItemDto })
  async resolveDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('driftId') driftId: string,
    @Body() dto: ResolveSupplierSourceDriftDto,
  ): Promise<SupplierSourceDriftItemDto> {
    return this.sourceIntegration.resolveOracleSourceDrift(
      accessContext,
      driftId,
      dto.resolutionNotes,
    );
  }

  @Post('import')
  @Permissions(PERMISSIONS.SUPPLIERS.SYNC)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Import Oracle Supplier SaaS extract (mock JSON) into staging',
  })
  @ApiResponse({ status: 201, type: OracleImportResponseDto })
  async importSuppliers(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: OracleSupplierImportDto,
  ): Promise<OracleImportResponseDto> {
    const result = await this.sourceIntegration.importSuppliers(accessContext, {
      records: dto.suppliers.map((s) => ({
        externalSupplierId: s.externalSupplierId,
        supplierNumber: s.supplierNumber ?? null,
        name: s.name,
        countryCode: s.countryCode,
        taxRegistrationNumber: s.taxRegistrationNumber ?? null,
        metadata: s.metadata,
      })),
    });
    return {
      summary: result.summary,
      rows: result.rows,
      syncRunId: result.syncRunId,
      syncRunStatus: result.syncRunStatus,
    };
  }

  @Post('sync')
  @Permissions(PERMISSIONS.SUPPLIERS.SYNC)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Incremental Oracle Procurement REST sync into staging (checkpointed)',
  })
  @ApiResponse({ status: 201, type: OracleImportResponseDto })
  async syncSuppliers(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<OracleImportResponseDto> {
    const result =
      await this.sourceIntegration.syncOracleSuppliersIncremental(accessContext);
    return {
      summary: result.summary,
      rows: result.rows,
      syncRunId: result.syncRunId,
      syncRunStatus: result.status,
      connectorHealth: result.connectorHealth,
    };
  }

  @Get('staging')
  @Permissions('suppliers:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'List Oracle supplier staging rows with match preview' })
  @ApiResponse({ status: 200, type: PaginatedOracleStagingResponseDto })
  async listStaging(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryOracleStagingDto,
  ): Promise<PaginatedOracleStagingResponseDto> {
    return this.sourceIntegration.listSupplierStaging(accessContext, {
      matchStatus: query.matchStatus,
      page: query.page,
      limit: query.limit,
    });
  }

  @Post('staging/promote')
  @Permissions(PERMISSIONS.SUPPLIERS.SYNC)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Create CMS governance records from MATCHED/NEW Oracle staging rows (batch)',
  })
  @ApiResponse({ status: 201, type: PromoteOracleStagingBatchResponseDto })
  async promoteStagingBatch(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: PromoteOracleStagingDto,
  ): Promise<PromoteOracleStagingBatchResponseDto> {
    return this.sourceIntegration.promoteSupplierStagingBatch(
      accessContext,
      dto.stagingIds,
    );
  }

  @Post('staging/:stagingId/promote')
  @Permissions(PERMISSIONS.SUPPLIERS.SYNC)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Create CMS governance record for Oracle staging row (never sets ACTIVE)',
  })
  @ApiResponse({ status: 201, type: GovernanceTwinPromotionResultDto })
  async promoteStagingRow(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('stagingId') stagingId: string,
  ): Promise<GovernanceTwinPromotionResultDto> {
    return this.sourceIntegration.promoteSupplierStagingRow(
      accessContext,
      stagingId,
    );
  }

  @Post('demo/complete-supplier-setup')
  @Permissions(PERMISSIONS.SUPPLIERS.APPROVE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'DEMO_MODE — assign portal membership and seed ACTIVE supplier contract for promoted Oracle demo supplier',
  })
  @ApiResponse({ status: 201, type: DemoSupplierSetupResponseDto })
  async completeDemoSupplierSetup(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<DemoSupplierSetupResponseDto> {
    return this.demoSupplierSetup.completeSupplierSetup(accessContext);
  }

  @Post('demo/complete-mtn-story')
  @Permissions(PERMISSIONS.SUPPLIERS.APPROVE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'DEMO_MODE — promote all five MTN suppliers, framework contracts, portal admins, materialize workers, and sponsored engagements',
  })
  @ApiResponse({ status: 201, type: DemoMtnStorySetupResponseDto })
  async completeMtnDemoStory(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<DemoMtnStorySetupResponseDto> {
    return this.demoMtnStorySetup.completeMtnStory(accessContext);
  }
}
