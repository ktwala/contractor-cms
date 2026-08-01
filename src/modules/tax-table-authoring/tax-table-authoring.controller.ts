import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  UseFilters,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { TaxTableAuthoringService } from './tax-table-authoring.service';
import { TaxTableAuthoringValidationService } from './tax-table-authoring.validation.service';
import { TaxTableAuthoringDiffService } from './tax-table-authoring.diff.service';
import { TaxTableAuthoringSimulationService } from './tax-table-authoring.simulation.service';
import { TaxTablePublishProjectionService } from './tax-table-publish-projection.service';
import { TaxTableTemplateRegistry } from './tax-table-template.registry';
import { TaxTableImportTemplateMapperService } from './services/tax-table-import-template-mapper.service';
import { TtaExceptionFilter } from './filters/tta-exception.filter';
import { PrismaService } from '../../core/database/prisma.service';
import {
  CreateFromTemplateDto,
  CreateFromCopyDto,
  CreateManualDto,
  UpdateBracketsDto,
  UpdateFieldsDto,
  SubmitApprovalDto,
  ApproveDto,
  PublishDto,
  SimulateDto,
  ImportBracketsDto,
} from './dto/tax-table-authoring.dto';

@ApiTags('Tax Table Authoring')
@ApiBearerAuth('bearerAuth')
@Controller('tax-table-authoring')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
@UseFilters(TtaExceptionFilter)
export class TaxTableAuthoringController {
  constructor(
    private readonly authoringService: TaxTableAuthoringService,
    private readonly validationService: TaxTableAuthoringValidationService,
    private readonly diffService: TaxTableAuthoringDiffService,
    private readonly simulationService: TaxTableAuthoringSimulationService,
    private readonly publishService: TaxTablePublishProjectionService,
    private readonly templateRegistry: TaxTableTemplateRegistry,
    private readonly importMapper: TaxTableImportTemplateMapperService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Templates ────────────────────────────────────────────────────────

  @Get('templates')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'List available tax table templates as card summaries' })
  @ApiQuery({ name: 'countryCode', required: false })
  @ApiQuery({ name: 'tableType', required: false })
  @ApiQuery({ name: 'taxYear', required: false })
  listTemplates(
    @Query('countryCode') countryCode?: string,
    @Query('tableType') tableType?: string,
    @Query('taxYear') taxYear?: string,
  ) {
    let templates = this.templateRegistry.listAvailable();
    if (countryCode) templates = templates.filter((t) => t.countryCode === countryCode);
    if (tableType) templates = templates.filter((t) => t.tableType === tableType);
    if (taxYear) templates = templates.filter((t) => t.taxYear === taxYear);

    return templates.map((t) => {
      const recommended = !!(countryCode && tableType && taxYear &&
        this.templateRegistry.getRecommended(countryCode, tableType, taxYear)?.templateId === t.templateId);
      return this.templateRegistry.toCardDto(t, recommended);
    });
  }

  @Get('templates/recommended')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Get the recommended template for a country/type/year' })
  @ApiQuery({ name: 'countryCode', required: true })
  @ApiQuery({ name: 'tableType', required: true })
  @ApiQuery({ name: 'taxYear', required: true })
  getRecommendedTemplate(
    @Query('countryCode') countryCode: string,
    @Query('tableType') tableType: string,
    @Query('taxYear') taxYear: string,
  ) {
    const template = this.templateRegistry.getRecommended(countryCode, tableType, taxYear);
    if (!template) return null;
    return this.templateRegistry.toCardDto(template, true);
  }

  @Get('templates/:templateId/import-workbook')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Get import workbook data derived from a template' })
  @ApiParam({ name: 'templateId' })
  getImportWorkbook(@Param('templateId') templateId: string) {
    const template = this.templateRegistry.getById(templateId);
    if (!template) return { message: 'Template not found' };
    return this.importMapper.mapTemplateToWorkbook(template);
  }

  // ── CRUD ─────────────────────────────────────────────────────────────

  @Post('versions/from-template')
  @Permissions('tax_table_authoring_create')
  @ApiOperation({ summary: 'Create authoring draft from a template' })
  async createFromTemplate(
    @Body() dto: CreateFromTemplateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.createFromTemplate({
      ...dto,
      actorUserId: user.sub,
    });
  }

  @Post('versions/from-copy')
  @Permissions('tax_table_authoring_create')
  @ApiOperation({ summary: 'Create authoring draft by copying an existing version' })
  async createFromCopy(
    @Body() dto: CreateFromCopyDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.createFromCopy({
      ...dto,
      actorUserId: user.sub,
    });
  }

  @Post('versions/manual')
  @Permissions('tax_table_authoring_create')
  @ApiOperation({ summary: 'Create authoring draft with manual bracket entry' })
  async createManual(
    @Body() dto: CreateManualDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.createManual({
      ...dto,
      actorUserId: user.sub,
    });
  }

  @Post('versions/import')
  @Permissions('tax_table_authoring_import')
  @ApiOperation({ summary: 'Create authoring draft from imported bracket data' })
  async createFromImport(
    @Body() dto: ImportBracketsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.createFromImport({
      ...dto,
      actorUserId: user.sub,
    });
  }

  @Get('versions')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'List authoring versions with optional filters' })
  @ApiQuery({ name: 'countryCode', required: false })
  @ApiQuery({ name: 'tableType', required: false })
  @ApiQuery({ name: 'taxYear', required: false })
  @ApiQuery({ name: 'status', required: false })
  async list(
    @Query('countryCode') countryCode?: string,
    @Query('tableType') tableType?: string,
    @Query('taxYear') taxYear?: string,
    @Query('status') status?: string,
  ) {
    return this.authoringService.list({
      countryCode,
      tableType,
      taxYear,
      status: status as any,
    });
  }

  @Get('versions/:id')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Get authoring version detail' })
  @ApiParam({ name: 'id' })
  async getById(@Param('id') id: string) {
    return this.authoringService.getById(id);
  }

  @Put('versions/:id/brackets')
  @Permissions('tax_table_authoring_edit')
  @ApiOperation({ summary: 'Replace all brackets on a draft version' })
  @ApiParam({ name: 'id' })
  async updateBrackets(
    @Param('id') id: string,
    @Body() dto: UpdateBracketsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.updateBrackets(id, dto.brackets, user.sub);
  }

  @Put('versions/:id/fields')
  @Permissions('tax_table_authoring_edit')
  @ApiOperation({ summary: 'Upsert supplemental fields on a draft version' })
  @ApiParam({ name: 'id' })
  async updateFields(
    @Param('id') id: string,
    @Body() dto: UpdateFieldsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.updateFields(id, dto.fields, user.sub);
  }

  // ── Lifecycle ────────────────────────────────────────────────────────

  @Post('versions/:id/submit-approval')
  @Permissions('tax_table_authoring_submit_approval')
  @ApiOperation({ summary: 'Submit draft for approval' })
  @ApiParam({ name: 'id' })
  async submitApproval(
    @Param('id') id: string,
    @Body() dto: SubmitApprovalDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.submitForApproval(id, user.sub, dto.comment);
  }

  @Post('versions/:id/approve')
  @Permissions('tax_table_authoring_approve')
  @ApiOperation({ summary: 'Approve a pending version' })
  @ApiParam({ name: 'id' })
  async approve(
    @Param('id') id: string,
    @Body() dto: ApproveDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const policy = this.publishService.getPolicy();
    return this.authoringService.approve(id, user.sub, dto.comment, {
      disallowSelfApproval: policy.disallowSelfApproval,
    });
  }

  @Post('versions/:id/archive')
  @Permissions('tax_table_authoring_archive')
  @ApiOperation({ summary: 'Archive a version' })
  @ApiParam({ name: 'id' })
  async archive(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.authoringService.archive(id, user.sub);
  }

  // ── Validation ───────────────────────────────────────────────────────

  @Get('versions/:id/validate')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Validate draft brackets and fields' })
  @ApiParam({ name: 'id' })
  async validate(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    const draft = await this.authoringService.getById(id);
    const issues = this.validationService.validateDraft(draft);
    const overlapWarnings =
      await this.validationService.checkRuntimeOverlap(draft);

    await this.prisma.taxTableAuthoringAuditEvent.create({
      data: {
        authoringVersionId: id,
        eventType: 'validation_run',
        actorUserId: user.sub,
        payloadJson: {
          errorCount: issues.filter((i) => i.severity === 'ERROR').length,
          warningCount: issues.filter((i) => i.severity === 'WARNING').length + overlapWarnings.length,
        },
      },
    });

    return { issues: [...issues, ...overlapWarnings] };
  }

  // ── Diff ─────────────────────────────────────────────────────────────

  @Get('versions/:id/diff')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Diff draft against currently active runtime TaxTableSet' })
  @ApiParam({ name: 'id' })
  async diffAgainstRuntime(@Param('id') id: string) {
    return this.diffService.diffAgainstRuntime(id);
  }

  @Get('versions/:idA/diff/:idB')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Diff two authoring versions against each other' })
  @ApiParam({ name: 'idA' })
  @ApiParam({ name: 'idB' })
  async diffBetweenVersions(
    @Param('idA') idA: string,
    @Param('idB') idB: string,
  ) {
    return this.diffService.diffBetweenVersions(idA, idB);
  }

  // ── Simulation ───────────────────────────────────────────────────────

  @Post('versions/:id/simulate')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Simulate tax outcomes against draft brackets' })
  @ApiParam({ name: 'id' })
  async simulate(
    @Param('id') id: string,
    @Body() dto: SimulateDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    const result = await this.simulationService.simulate(id, dto);

    await this.prisma.taxTableAuthoringAuditEvent.create({
      data: {
        authoringVersionId: id,
        eventType: 'simulation_run',
        actorUserId: user.sub,
        payloadJson: {
          incomeCount: dto.annualIncomes.length,
          periodsPerYear: dto.periodsPerYear ?? 12,
        },
      },
    });

    return result;
  }

  // ── Publish ──────────────────────────────────────────────────────────

  @Post('versions/:id/publish')
  @Permissions('tax_table_authoring_publish')
  @ApiOperation({ summary: 'Publish approved version into runtime TaxTableSet' })
  @ApiParam({ name: 'id' })
  async publish(
    @Param('id') id: string,
    @Body() dto: PublishDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.publishService.publishAuthoringVersion({
      authoringVersionId: id,
      actorUserId: user.sub,
      reason: dto.reason,
    });
  }

  @Get('publish-policy')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Get current publish policy configuration' })
  async getPublishPolicy() {
    return this.publishService.getPolicy();
  }

  // ── Audit ────────────────────────────────────────────────────────────

  @Get('versions/:id/audit')
  @Permissions('tax_table_authoring_audit_view')
  @ApiOperation({ summary: 'Get audit trail for an authoring version' })
  @ApiParam({ name: 'id' })
  async getAuditTrail(@Param('id') id: string) {
    return this.authoringService.getAuditTrail(id);
  }

  // ── Runtime Inspection (TTA-HARDEN-019) ──────────────────────────────

  @Get('runtime/active')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Inspect currently active runtime TaxTableSet' })
  @ApiQuery({ name: 'country', required: true })
  @ApiQuery({ name: 'tableType', required: true })
  @ApiQuery({ name: 'date', required: false })
  async getActiveRuntime(
    @Query('country') country: string,
    @Query('tableType') tableType: string,
    @Query('date') date?: string,
  ) {
    const computeDate = date ? new Date(date) : new Date();
    const row = await this.prisma.taxTableSet.findFirst({
      where: {
        country: country as any,
        tableType: tableType as any,
        status: 'ACTIVE',
        effectiveFrom: { lte: computeDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: computeDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
    return row ?? { message: 'No active runtime TaxTableSet found for criteria' };
  }

  @Get('runtime/:taxTableSetId')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Inspect a specific runtime TaxTableSet by ID' })
  @ApiParam({ name: 'taxTableSetId' })
  async getRuntimeById(@Param('taxTableSetId') taxTableSetId: string) {
    return this.prisma.taxTableSet.findUnique({ where: { id: taxTableSetId } });
  }

  @Get('versions/:id/published-runtime')
  @Permissions('tax_table_authoring_view')
  @ApiOperation({ summary: 'Get the runtime TaxTableSet published from an authoring version' })
  @ApiParam({ name: 'id' })
  async getPublishedRuntime(@Param('id') id: string) {
    const draft = await this.authoringService.getById(id);
    if (!draft.publishedTaxTableSetId) {
      return { message: 'This version has not been published' };
    }
    return this.prisma.taxTableSet.findUnique({
      where: { id: draft.publishedTaxTableSetId },
    });
  }
}
