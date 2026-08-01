import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
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
import { DemoHcmStagingMaterializationService } from '../demo/demo-hcm-staging-materialization.service';
import { HcmWorkforceCutoverService } from './hcm-workforce-cutover.service';
import { HcmBootstrapDecayService } from './hcm-bootstrap-decay.service';
import {
  OracleHcmFileImportDto,
  OracleHcmSyncResponseDto,
} from './dto/oracle-hcm-import.dto';
import {
  AssignContractorSourceDriftDto,
  BootstrapDecaySummaryDto,
  ContractorSourceDriftItemDto,
  DetectContractorSourceDriftResponseDto,
  PaginatedContractorSourceDriftResponseDto,
  QueryContractorSourceDriftDto,
  ResolveContractorSourceDriftDto,
  SetWorkforceCutoverDto,
  WorkforceCutoverResponseDto,
} from './dto/contractor-source-drift.dto';

@ApiTags('contractor-sources')
@Controller('contractor-sources/oracle-hcm')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class OracleHcmImportController {
  constructor(
    private readonly sourceIntegration: SourceIntegrationService,
    private readonly demoMaterialize: DemoHcmStagingMaterializationService,
    private readonly cutoverService: HcmWorkforceCutoverService,
    private readonly decayService: HcmBootstrapDecayService,
  ) {}

  @Get('health')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Oracle HCM connector health (read-only)' })
  async getHealth(@CurrentAccessContext() accessContext: AccessContext) {
    return this.sourceIntegration.getOracleHcmConnectorHealth(accessContext);
  }

  @Post('sync')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Incremental Oracle HCM contractor sync into staging' })
  @ApiResponse({ status: 201, type: OracleHcmSyncResponseDto })
  async syncContractors(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<OracleHcmSyncResponseDto> {
    return this.sourceIntegration.syncOracleHcmContractorsIncremental(accessContext);
  }

  @Post('import')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Replay-safe file import into HCM contractor staging' })
  @ApiResponse({ status: 201, type: OracleHcmSyncResponseDto })
  async importFromFile(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: OracleHcmFileImportDto,
  ): Promise<OracleHcmSyncResponseDto> {
    return this.sourceIntegration.importOracleHcmContractorsFromFile(
      accessContext,
      dto,
    );
  }

  @Get('telemetry')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Workforce connector telemetry (ledger + staging derived)',
  })
  async getTelemetry(@CurrentAccessContext() accessContext: AccessContext) {
    return this.sourceIntegration.getOracleHcmConnectorTelemetry(accessContext);
  }

  @Get('dashboard')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Workforce Governance Operations dashboard',
  })
  async getDashboard(@CurrentAccessContext() accessContext: AccessContext) {
    return this.sourceIntegration.getOracleHcmConnectorDashboard(accessContext);
  }

  @Get('sync-runs')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Paginated HCM contractor sync-run history' })
  async listSyncRuns(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    return this.sourceIntegration.listOracleHcmSyncRuns(accessContext, {
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
    });
  }

  @Get('drift')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'List governed workforce drift records' })
  @ApiResponse({ status: 200, type: PaginatedContractorSourceDriftResponseDto })
  async listDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query() query: QueryContractorSourceDriftDto,
  ): Promise<PaginatedContractorSourceDriftResponseDto> {
    return this.sourceIntegration.listOracleHcmSourceDrift(accessContext, query);
  }

  @Get('drift/summary')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Workforce drift severity summary' })
  async getDriftSummary(@CurrentAccessContext() accessContext: AccessContext) {
    return this.sourceIntegration.getOracleHcmSourceDriftSummary(accessContext);
  }

  // ── PR-GOV-SIGNAL-LIFECYCLE-2 — Workforce cutover ceremony ───────────────

  @Get('cutover')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Get workforce migration cutover state (governancePhase + timestamp)',
  })
  @ApiResponse({ status: 200, type: WorkforceCutoverResponseDto })
  async getCutover(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<WorkforceCutoverResponseDto> {
    return this.cutoverService.getCutover(accessContext.targetOrganizationId!);
  }

  @Post('cutover')
  @Permissions(PERMISSIONS.WORKFORCE.CUTOVER_MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Declare or clear workforce migration cutover. ' +
      'Emits WORKFORCE_CUTOVER_SET or WORKFORCE_CUTOVER_CLEARED audit event. ' +
      'Enforces invariants: requires at least one successful import and at least one ' +
      'materialized contractor before a cutover date can be set.',
  })
  @ApiResponse({ status: 201, type: WorkforceCutoverResponseDto })
  @ApiResponse({
    status: 400,
    description:
      'Invariant violation — no successful import or no materialized contractors.',
  })
  async setCutover(
    @CurrentAccessContext() accessContext: AccessContext,
    @Body() dto: SetWorkforceCutoverDto,
  ): Promise<WorkforceCutoverResponseDto> {
    return this.cutoverService.setCutover(
      accessContext.targetOrganizationId!,
      dto.cutoverAt,
      accessContext.actorUserId,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────

  // ── PR-GOV-SIGNAL-LIFECYCLE-3 — Bootstrap decay ──────────────────────

  @Post('bootstrap-decay/apply')
  @Permissions(PERMISSIONS.WORKFORCE.CUTOVER_MANAGE)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'Evaluate and apply bootstrap signal decay for this organization. ' +
      'Transitions eligible BOOTSTRAP signals: ACTIVE→DECAYING (post-cutover) ' +
      'and DECAYING→ARCHIVED (after grace period). ' +
      'Emits BOOTSTRAP_SIGNAL_ARCHIVED audit event when signals are archived. ' +
      'OPERATIONAL signals are never touched.',
  })
  @ApiResponse({ status: 201, type: BootstrapDecaySummaryDto })
  async applyBootstrapDecay(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<BootstrapDecaySummaryDto> {
    return this.decayService.applyDecayForOrganization(
      accessContext.targetOrganizationId!,
      accessContext.actorUserId,
    );
  }

  // ────────────────────────────────────────────────────────────────────────

  @Post('demo/materialize-contractors')
  @Permissions(PERMISSIONS.CONTRACTORS.BOOTSTRAP)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary:
      'DEMO_MODE — create visible CMS contractors from HCM staging after connector sync',
  })
  async materializeDemoContractors(@CurrentAccessContext() accessContext: AccessContext) {
    const orgId = accessContext.targetOrganizationId!;
    return this.demoMaterialize.materializeVisibleContractors(orgId);
  }

  @Post('drift/detect')
  @Permissions(PERMISSIONS.CONTRACTORS.GOVERNANCE_SCAN)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({
    summary: 'Run workforce drift detection (no auto-remediation)',
  })
  @ApiResponse({ status: 201, type: DetectContractorSourceDriftResponseDto })
  @ApiResponse({
    status: 409,
    description:
      'Assessment blocked — discovery not complete or latest snapshot already assessed',
  })
  async detectDrift(
    @CurrentAccessContext() accessContext: AccessContext,
  ): Promise<DetectContractorSourceDriftResponseDto> {
    return this.sourceIntegration.detectOracleHcmSourceDrift(accessContext);
  }

  @Get('drift/:driftId')
  @Permissions('contractor-migration:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: ContractorSourceDriftItemDto })
  async getDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('driftId') driftId: string,
  ): Promise<ContractorSourceDriftItemDto> {
    return this.sourceIntegration.getOracleHcmSourceDrift(accessContext, driftId);
  }

  @Post('drift/:driftId/assign')
  @Permissions(PERMISSIONS.CONTRACTORS.GOVERNANCE_SCAN)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: ContractorSourceDriftItemDto })
  async assignDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('driftId') driftId: string,
    @Body() dto: AssignContractorSourceDriftDto,
  ): Promise<ContractorSourceDriftItemDto> {
    return this.sourceIntegration.assignOracleHcmSourceDrift(
      accessContext,
      driftId,
      dto.assignedToUserId,
    );
  }

  @Post('drift/:driftId/resolve')
  @Permissions(PERMISSIONS.CONTRACTORS.GOVERNANCE_SCAN)
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiResponse({ status: 200, type: ContractorSourceDriftItemDto })
  async resolveDrift(
    @CurrentAccessContext() accessContext: AccessContext,
    @Param('driftId') driftId: string,
    @Body() dto: ResolveContractorSourceDriftDto,
  ): Promise<ContractorSourceDriftItemDto> {
    return this.sourceIntegration.resolveOracleHcmSourceDrift(
      accessContext,
      driftId,
      dto.resolutionNotes,
    );
  }
}
