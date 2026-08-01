import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { PayrunsService, type RequestUser } from './payruns.service';
import { PayrunLifecycleService } from './payrun-lifecycle.service';
import { PayrunSnapshotService } from './payrun-snapshot.service';
import { PayrunCalculationService } from './payrun-calculation.service';
import { PayrunEngineService } from './payrun-engine.service';
import { PayrunReconciliationService } from './payrun-reconciliation.service';
import { PrismaService } from '../../core/database/prisma.service';
import { CreatePayRunDto } from './dto/create-payrun.dto';
import { PreviewPayrunInclusionsDto } from './dto/preview-payrun-inclusions.dto';
import { ListPayRunsDto } from './dto/list-payruns.dto';
import { SnapshotRequestDto } from './dto/snapshot.dto';
import { CalculateRequestDto } from './dto/calculate.dto';
import {
  MarkPaidRequestDto,
  MarkPostedRequestDto,
  RevertToDraftRequestDto,
  CancelPayrunRequestDto,
} from './dto/lifecycle.dto';
import { LineItemInputDto } from './dto/line-item-input.dto';
import { AdjustmentPayRunCreateDto } from './dto/adjustment.dto';
import {
  PayRunResponseDto,
  PaginatedPayRunsDto,
  PayRunContextDto,
  LockRulesResponseDto,
  PayRunSummaryDto,
} from './dto/payrun-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders, ApiReasonHeader } from '../../common/decorators/api-headers.decorator';
import {
  PayrunReadinessGateService,
  type PayrunReadinessOverrideHeaders,
} from './payrun-readiness-gate.service';
import {
  PayrunFinancialControlService,
  type PayrunFinancialOverrideHeaders,
} from './payrun-financial-control.service';
import {
  PayrunBankReconciliationService,
  type PayrunBankOverrideHeaders,
} from './payrun-bank-reconciliation.service';
import { BankConfirmationImportDto } from './dto/bank-confirmation-import.dto';
import { BankConfirmationReviewDto } from './dto/bank-confirmation-review.dto';
import { PayrunGLReconciliationService } from './payrun-gl-reconciliation.service';
import { GlConfirmationImportDto } from './dto/gl-confirmation-import.dto';
import { GlConfirmationReviewDto } from './dto/gl-confirmation-review.dto';
import {
  PayrunClosedPeriodMutationGuardService,
  type PayrunClosedPeriodMutationHeaders,
} from './payrun-closed-period-mutation-guard.service';
import { PayrunReversalWorkflowService } from './payrun-reversal-workflow.service';
import { PayrunCorrectionApprovalService } from './payrun-correction-approval.service';
import { PayrunPostCloseReconciliationImpactService } from './payrun-post-close-reconciliation-impact.service';
import { PayrunGovernanceHealthService } from './payrun-governance-health.service';

@ApiTags('PayRuns')
@ApiBearerAuth('bearerAuth')
@Controller('payruns')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PayrunsController {
  constructor(
    private readonly payrunsService: PayrunsService,
    private readonly lifecycleService: PayrunLifecycleService,
    private readonly snapshotService: PayrunSnapshotService,
    private readonly calculationService: PayrunCalculationService,
    private readonly engineService: PayrunEngineService,
    private readonly reconciliationService: PayrunReconciliationService,
    private readonly prisma: PrismaService,
    private readonly readinessGate: PayrunReadinessGateService,
    private readonly financialControl: PayrunFinancialControlService,
    private readonly bankReconciliation: PayrunBankReconciliationService,
    private readonly glReconciliation: PayrunGLReconciliationService,
    private readonly closedPeriodGuard: PayrunClosedPeriodMutationGuardService,
    private readonly reversalWorkflows: PayrunReversalWorkflowService,
    private readonly correctionApprovals: PayrunCorrectionApprovalService,
    private readonly postCloseReconciliationImpact: PayrunPostCloseReconciliationImpactService,
    private readonly governanceHealth: PayrunGovernanceHealthService,
  ) {}

  private firstHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const v = headers[name.toLowerCase()] ?? headers[name];
    if (Array.isArray(v)) return v[0];
    return typeof v === 'string' ? v : undefined;
  }

  private readinessOverrideFrom(
    headers: Record<string, string | string[] | undefined>,
  ): PayrunReadinessOverrideHeaders {
    return {
      overrideHeader: this.firstHeader(headers, 'x-readiness-gate-override'),
      justification: this.firstHeader(headers, 'x-readiness-override-justification'),
    };
  }

  private financialOverrideFrom(
    headers: Record<string, string | string[] | undefined>,
  ): PayrunFinancialOverrideHeaders {
    return {
      overrideHeader: this.firstHeader(headers, 'x-financial-gate-override'),
      justification: this.firstHeader(headers, 'x-financial-override-justification'),
    };
  }

  private bankOverrideFrom(headers: Record<string, string | string[] | undefined>): PayrunBankOverrideHeaders {
    return {
      overrideHeader: this.firstHeader(headers, 'x-bank-gate-override'),
      justification: this.firstHeader(headers, 'x-bank-override-justification'),
    };
  }

  private closedPeriodHeadersFrom(
    headers: Record<string, string | string[] | undefined>,
  ): PayrunClosedPeriodMutationHeaders {
    return {
      bypassHeader: this.firstHeader(headers, 'x-closed-period-mutation-bypass'),
      justification: this.firstHeader(headers, 'x-closed-period-mutation-justification'),
      reversalWorkflowId: this.firstHeader(headers, 'x-reversal-workflow-id'),
      correctionApprovalId: this.firstHeader(headers, 'x-payrun-correction-approval-id'),
    };
  }

  private gateUser(user: CurrentUserData) {
    return { sub: user.sub, permissions: user.permissions };
  }

  private async assertReadinessForPayrun(
    payrunId: string,
    user: CurrentUserData,
    headers: Record<string, string | string[] | undefined>,
    operation: string,
  ): Promise<void> {
    const row = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { payGroupId: true },
    });
    if (!row) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }
    await this.readinessGate.assertPayGroupAllowed(
      row.payGroupId,
      user,
      this.readinessOverrideFrom(headers),
      operation,
    );
  }

  @Post()
  @Permissions('payrun:create')
  @ApiOperation({ summary: 'Create a payrun (REGULAR)' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: PayRunResponseDto })
  async create(
    @Body() dto: CreatePayRunDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.readinessGate.assertPayGroupAllowed(
      dto.pay_group_id,
      user,
      this.readinessOverrideFrom(hdrs ?? {}),
      'payrun.create',
    );
    return this.payrunsService.create(dto, user, reason, this.closedPeriodHeadersFrom(hdrs ?? {}));
  }

  @Post('preview-inclusions')
  @Permissions('payrun:create')
  @ApiOperation({
    summary: 'Preview employee eligibility before creating a payrun (same rules as snapshot inclusion preview)',
  })
  @ApiResponse({ status: 200, description: 'OK' })
  async previewInclusionsBeforeCreate(
    @Body() dto: PreviewPayrunInclusionsDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.snapshotService.previewInclusionsBeforeCreate(dto, user);
  }

  @Get()
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'List payruns' })
  @ApiResponse({ status: 200, description: 'OK', type: PaginatedPayRunsDto })
  async findAll(
    @Query() query: ListPayRunsDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PaginatedPayRunsDto> {
    return this.payrunsService.findAll(query, user);
  }

  @Get(':payrun_id')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Get a payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'OK', type: PayRunResponseDto })
  async findOne(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PayRunResponseDto> {
    return this.payrunsService.findOne(id, user);
  }

  @Get(':payrun_id/context')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Get resolved payrun context for reproducibility' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'OK', type: PayRunContextDto })
  async getContext(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PayRunContextDto> {
    return this.payrunsService.getContext(id, user);
  }

  @Get(':payrun_id/lock-rules')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Get lock rules for the payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'OK', type: LockRulesResponseDto })
  async getLockRules(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<LockRulesResponseDto> {
    return this.payrunsService.getLockRules(id, user);
  }

  @Post(':payrun_id/inclusions/preview')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Preview which employees will be included' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'OK' })
  async previewInclusions(
    @Param('payrun_id') id: string,
    @Body() body: { filters?: Record<string, any> },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.snapshotService.previewInclusions(id, body.filters, user);
  }

  @Post(':payrun_id/snapshot')
  @Permissions('payrun:snapshot')
  @ApiOperation({ summary: 'Commit snapshot (freezes included employees + effective-dated inputs)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 200, description: 'Snapshotted' })
  async snapshot(
    @Param('payrun_id') id: string,
    @Body() dto: SnapshotRequestDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ) {
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.snapshot');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.snapshot',
    );
    return this.snapshotService.snapshot(
      id,
      dto.snapshot_effective_at,
      dto.include_employee_ids,
      dto.exclude_employee_ids,
      user,
      reason,
    );
  }

  @Post(':payrun_id/employees')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Include or exclude a single employee' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Updated' })
  async includeExcludeEmployee(
    @Param('payrun_id') id: string,
    @Body() body: { employee_id: string; action: 'INCLUDE' | 'EXCLUDE'; note?: string },
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ) {
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.include_exclude_employee',
    );
    return this.snapshotService.includeExcludeEmployee(
      id,
      body.employee_id,
      body.action,
      body.note,
      user,
      reason,
    );
  }

  @Delete(':payrun_id/employees/:employee_id')
  @Permissions('payrun:edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove an employee from payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  async removeEmployee(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
    @CurrentUser() user: CurrentUserData,
    @Query('reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ) {
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      payrunId,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.remove_employee',
    );
    await this.snapshotService.removeEmployee(payrunId, employeeId, user, reason);
  }

  @Post(':payrun_id/inputs/line-items')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Add a one-off line item input to the payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 201, description: 'Created' })
  async addLineItemInput(
    @Param('payrun_id') payrunId: string,
    @Body() dto: LineItemInputDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      payrunId,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.line_item_input',
    );
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { id: true, status: true, payGroupId: true },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    if (!['DRAFT', 'SNAPSHOT'].includes(payrun.status)) {
      throw new BadRequestException(`Cannot add line item inputs to payrun in ${payrun.status} status`);
    }

    // Look up pay item by code
    const payItem = await this.prisma.payItem.findFirst({
      where: {
        code: dto.pay_item_code,
        payGroupId: payrun.payGroupId,
      },
    });

    if (!payItem) {
      throw new NotFoundException(`Pay item with code ${dto.pay_item_code} not found`);
    }

    // Create the line item input
    const lineItemInput = await this.prisma.lineItemInput.create({
      data: {
        payrunId,
        employeeId: dto.employee_id,
        payItemId: payItem.id,
        amount: dto.amount,
        currency: dto.currency || 'ZAR',
        meta: dto.meta,
      },
    });

    return {
      id: lineItemInput.id,
      employee_id: lineItemInput.employeeId,
      pay_item_code: dto.pay_item_code,
      amount: lineItemInput.amount,
      currency: lineItemInput.currency,
      meta: lineItemInput.meta,
      created_at: lineItemInput.createdAt.toISOString(),
    };
  }

  @Post(':payrun_id/calculate')
  @Permissions('payrun:calculate')
  @ApiOperation({ summary: 'Start payroll calculation' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 202, description: 'Accepted (async) or completed (sync with use_engine)' })
  async calculate(
    @Param('payrun_id') id: string,
    @Body() dto: CalculateRequestDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ) {
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.calculate');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.calculate',
    );
    // Default: use country-pack engine (statutory configuration-aware)
    // Legacy calculation service available via use_engine=false
    if (dto.use_engine === false) {
      return this.calculationService.startCalculation(
        id,
        dto.mode,
        dto.recalculate_employee_ids,
        user.sub,
        reason,
      );
    }

    return this.engineService.calculate(
      id,
      dto.mode,
      dto.recalculate_employee_ids,
      user.sub,
    );
  }

  @Get(':payrun_id/summary')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Get summary totals for a payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'OK', type: PayRunSummaryDto })
  async getSummary(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<PayRunSummaryDto> {
    return this.payrunsService.getSummary(id, user);
  }

  @Get(':payrun_id/financial-control')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Payroll register vs payment export financial control (GOV-3A)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async getFinancialControl(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.financialControl.getForPayrun(id);
  }

  @Post(':payrun_id/financial-control/reconcile')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Recompute register vs export reconciliation' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async reconcileFinancialControl(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.financialControl.reconcilePayrun(id, user.sub);
  }

  @Post(':payrun_id/financial-control/review')
  @Permissions('payrun:approve')
  @ApiOperation({ summary: 'Acknowledge variance review (soft-warning path)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async acknowledgeFinancialVariance(
    @Param('payrun_id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.financialControl.acknowledgeVarianceReview(id, user.sub, body?.note);
  }

  @Get(':payrun_id/bank-reconciliation')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Payment export vs bank confirmation (GOV-3B) for controlling batch' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async getBankReconciliation(@Param('payrun_id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.payrunsService.findOne(id, user);
    return this.bankReconciliation.getForPayrun(id);
  }

  @Post(':payrun_id/bank-confirmation/import')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Import bank confirmation / settlement data for the exported batch (GOV-3B)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async importBankConfirmation(
    @Param('payrun_id') id: string,
    @Body() dto: BankConfirmationImportDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.bankReconciliation.importBankConfirmation(id, user.sub, dto);
  }

  @Post(':payrun_id/bank-confirmation/review')
  @Permissions('payrun:approve')
  @ApiOperation({ summary: 'Acknowledge bank reconciliation review (rejects / partials / fee variance)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async acknowledgeBankReconciliationReview(
    @Param('payrun_id') id: string,
    @Body() body: BankConfirmationReviewDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.bankReconciliation.acknowledgeBankReview(id, user.sub, body?.note);
  }

  @Get(':payrun_id/gl-reconciliation')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Payroll register vs GL posting (GOV-3C)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async getGlReconciliation(@Param('payrun_id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.payrunsService.findOne(id, user);
    return this.glReconciliation.getForPayrun(id);
  }

  @Get(':payrun_id/post-close-reconciliation-impact')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'GOV-4 — post-reversal / correction reconciliation impact on source payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async getPostCloseReconciliationImpact(@Param('payrun_id') id: string, @CurrentUser() user: CurrentUserData) {
    await this.payrunsService.findOne(id, user);
    return this.postCloseReconciliationImpact.getSummary(id);
  }

  @Post(':payrun_id/post-close-reconciliation-impact/acknowledge')
  @Permissions('payrun:approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Acknowledge post-close reconciliation impact after re-truthing 3A/3B/3C (clears GOV-4 flags)',
  })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async acknowledgePostCloseReconciliationImpact(
    @Param('payrun_id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.postCloseReconciliationImpact.acknowledgeImpact(id, user.sub, body?.note);
  }

  @Get(':payrun_id/governance-health')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'GOV-5A — supervisory governance health snapshot for this payrun (control plane v1)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async getGovernanceHealth(@Param('payrun_id') id: string, @CurrentUser() user: CurrentUserData) {
    return this.governanceHealth.getHealthForPayrun(id, user as RequestUser);
  }

  @Post(':payrun_id/gl-confirmation/import')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Import GL / ERP posting totals for register comparison (GOV-3C)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async importGlConfirmation(
    @Param('payrun_id') id: string,
    @Body() dto: GlConfirmationImportDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.glReconciliation.importGlConfirmation(id, user.sub, dto);
  }

  @Post(':payrun_id/gl-confirmation/review')
  @Permissions('payrun:approve')
  @ApiOperation({ summary: 'Acknowledge GL variance review' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async acknowledgeGlReconciliationReview(
    @Param('payrun_id') id: string,
    @Body() body: GlConfirmationReviewDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(id, user);
    return this.glReconciliation.acknowledgeVarianceReview(id, user.sub, body?.note);
  }

  @Get(':payrun_id/results')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'List employee results for a payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'OK' })
  async listResults(
    @Param('payrun_id') id: string,
    @Query('offset') offset?: number,
    @Query('limit') limit?: number,
  ) {
    return this.calculationService.getResults(id, offset, limit);
  }

  @Get(':payrun_id/results/:employee_id')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Get detailed results for one employee' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getEmployeeResult(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
  ) {
    return this.calculationService.getEmployeeResult(payrunId, employeeId);
  }

  @Get(':payrun_id/results/:employee_id/trace')
  @Permissions('payrun:trace:read')
  @ApiOperation({ summary: 'Get calculation trace for one employee' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'OK' })
  async getEmployeeTrace(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
  ) {
    return this.calculationService.getEmployeeTrace(payrunId, employeeId);
  }

  @Post(':payrun_id/submit-for-approval')
  @Permissions('payrun:submit')
  @ApiOperation({ summary: 'Submit payrun for approval' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Submitted', type: PayRunResponseDto })
  async submitForApproval(
    @Param('payrun_id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.submit_for_approval');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.submit_for_approval',
    );
    return this.lifecycleService.submitForApproval(id, body.note, user, reason);
  }

  @Post(':payrun_id/approve')
  @Permissions('payrun:approve')
  @ApiOperation({ summary: 'Approve payrun (locks results)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 200, description: 'Approved', type: PayRunResponseDto })
  async approve(
    @Param('payrun_id') id: string,
    @Body() body: { approval_comment?: string },
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.approve');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.approve',
    );
    return this.lifecycleService.approve(id, body.approval_comment, user, reason);
  }

  @Post(':payrun_id/revert-to-draft')
  @Permissions('payrun:admin')
  @ApiOperation({ summary: 'Revert payrun to draft' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Reverted', type: PayRunResponseDto })
  async revertToDraft(
    @Param('payrun_id') id: string,
    @Body() dto: RevertToDraftRequestDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.revert_to_draft',
    );
    return this.lifecycleService.revertToDraft(id, dto.reason, user, reason);
  }

  @Post(':payrun_id/cancel')
  @Permissions('payrun:cancel')
  @ApiOperation({ summary: 'Cancel payrun (terminal) before approval / payment / export' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Cancelled', type: PayRunResponseDto })
  async cancelPayrun(
    @Param('payrun_id') id: string,
    @Body() dto: CancelPayrunRequestDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.cancel',
    );
    return this.lifecycleService.cancelPayrun(id, dto.reason, user, reason);
  }

  @Post(':payrun_id/mark-paid')
  @Permissions('payrun:pay')
  @ApiOperation({ summary: 'Mark payrun as paid' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Marked paid', type: PayRunResponseDto })
  async markPaid(
    @Param('payrun_id') id: string,
    @Body() dto: MarkPaidRequestDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.financialControl.assertAllowsMarkPaidOrPosted(
      id,
      user,
      this.financialOverrideFrom(hdrs ?? {}),
      'payrun.mark_paid',
    );
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.mark_paid');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.mark_paid',
    );
    return this.lifecycleService.markPaid(id, dto.paid_at, dto.payment_reference, user, reason);
  }

  @Post(':payrun_id/mark-posted')
  @Permissions('payrun:post')
  @ApiOperation({ summary: 'Mark payrun as posted to GL' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  @ApiResponse({ status: 200, description: 'Marked posted', type: PayRunResponseDto })
  async markPosted(
    @Param('payrun_id') id: string,
    @Body() dto: MarkPostedRequestDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.financialControl.assertAllowsMarkPaidOrPosted(
      id,
      user,
      this.financialOverrideFrom(hdrs ?? {}),
      'payrun.mark_posted',
    );
    await this.bankReconciliation.assertAllowsMarkPostedBankGate(
      id,
      user,
      this.bankOverrideFrom(hdrs ?? {}),
      'payrun.mark_posted',
    );
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.mark_posted');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.mark_posted',
    );
    return this.lifecycleService.markPosted(id, dto.posted_at, dto.gl_reference, user, reason);
  }

  @Post(':payrun_id/finalize')
  @Permissions('payrun:finalize')
  @ApiOperation({ summary: 'Finalize payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 200, description: 'Finalized', type: PayRunResponseDto })
  async finalize(
    @Param('payrun_id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.finalize');
    await this.closedPeriodGuard.assertAllowsPayrunTemporalMutation(
      id,
      this.gateUser(user),
      this.closedPeriodHeadersFrom(hdrs ?? {}),
      'payrun.finalize',
    );
    return this.lifecycleService.finalize(id, body.note, user, reason);
  }

  @Post(':payrun_id/reconciliation/run')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Run reconciliation checks for a payrun' })
  async runReconciliation(
    @Param('payrun_id') id: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.reconciliationService.runReconciliation(id, user?.sub);
  }

  @Get(':payrun_id/reconciliation')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'Get reconciliation result for a payrun' })
  async getReconciliation(@Param('payrun_id') id: string) {
    return this.reconciliationService.runReconciliation(id);
  }

  @Post(':payrun_id/reconciliation/review')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Mark reconciliation as reviewed' })
  async reviewReconciliation(
    @Param('payrun_id') id: string,
    @Body() body: { reviewNote?: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    return this.reconciliationService.reviewReconciliation(id, user?.sub, body.reviewNote);
  }

  @Post(':payrun_id/create-adjustment')
  @Permissions('payrun:adjust')
  @ApiOperation({ summary: 'Create an adjustment payrun against a base payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiPayrollHeaders()
  @ApiResponse({ status: 201, description: 'Created', type: PayRunResponseDto })
  async createAdjustment(
    @Param('payrun_id') id: string,
    @Body() dto: AdjustmentPayRunCreateDto,
    @CurrentUser() user: CurrentUserData,
    @Headers('x-reason') reason?: string,
    @Headers() hdrs?: Record<string, string | string[] | undefined>,
  ): Promise<PayRunResponseDto> {
    await this.assertReadinessForPayrun(id, user, hdrs ?? {}, 'payrun.create_adjustment');
    return this.lifecycleService.createAdjustment(
      id,
      dto.adjustment_reason,
      dto.adjustment_mode,
      dto.include_employee_ids,
      user,
      reason,
    );
  }

  // ── GOV-3D-2: governed reversal / correction workflows ─────────────────

  @Get(':payrun_id/reversal-workflows')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'List reversal workflows for a source payrun (GOV-3D-2)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async listReversalWorkflows(@Param('payrun_id') payrunId: string, @CurrentUser() user: CurrentUserData) {
    await this.payrunsService.findOne(payrunId, user);
    return this.reversalWorkflows.listForSourcePayrun(payrunId);
  }

  @Post(':payrun_id/reversal-workflows')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Request a governed reversal workflow (closed period, finalized REGULAR)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  async createReversalWorkflow(
    @Param('payrun_id') payrunId: string,
    @Body() body: { reason: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    return this.reversalWorkflows.createRequest(payrunId, body.reason, user.sub);
  }

  @Post(':payrun_id/reversal-workflows/:workflow_id/approve')
  @Permissions('payrun:approve')
  @ApiOperation({ summary: 'Approve a pending reversal workflow' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'workflow_id', example: 'wf_1' })
  async approveReversalWorkflow(
    @Param('payrun_id') payrunId: string,
    @Param('workflow_id') workflowId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    const wf = await this.prisma.payrunReversalWorkflow.findFirst({
      where: { id: workflowId, sourcePayrunId: payrunId },
    });
    if (!wf) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Reversal workflow not found for this payrun' });
    }
    return this.reversalWorkflows.approve(workflowId, user.sub);
  }

  @Post(':payrun_id/reversal-workflows/:workflow_id/link-reversal-payrun')
  @Permissions('payrun:adjust')
  @ApiOperation({ summary: 'Link the compensating ADJUSTMENT payrun to an approved reversal workflow' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'workflow_id', example: 'wf_1' })
  async linkReversalPayrun(
    @Param('payrun_id') payrunId: string,
    @Param('workflow_id') workflowId: string,
    @Body() body: { reversal_payrun_id: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    if (!body?.reversal_payrun_id) {
      throw new BadRequestException({ code: 'REVERSAL_PAYRUN_REQUIRED', message: 'reversal_payrun_id is required' });
    }
    return this.reversalWorkflows.linkReversalPayrun(payrunId, workflowId, body.reversal_payrun_id, user.sub);
  }

  @Get(':payrun_id/correction-approvals')
  @Permissions('payrun:read')
  @ApiOperation({ summary: 'List correction approvals for a payrun (GOV-3D-2)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  async listCorrectionApprovals(@Param('payrun_id') payrunId: string, @CurrentUser() user: CurrentUserData) {
    await this.payrunsService.findOne(payrunId, user);
    return this.correctionApprovals.listForPayrun(payrunId);
  }

  @Post(':payrun_id/correction-approvals')
  @Permissions('payrun:edit')
  @ApiOperation({ summary: 'Request a governed correction approval (closed period REGULAR)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiReasonHeader()
  async createCorrectionApproval(
    @Param('payrun_id') payrunId: string,
    @Body() body: { requested_change_scope: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    return this.correctionApprovals.createRequest(payrunId, body.requested_change_scope, user.sub);
  }

  @Post(':payrun_id/correction-approvals/:approval_id/approve')
  @Permissions('payrun:approve')
  @ApiOperation({ summary: 'Approve a pending correction request' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'approval_id', example: 'ca_1' })
  async approveCorrectionApproval(
    @Param('payrun_id') payrunId: string,
    @Param('approval_id') approvalId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    const row = await this.prisma.payrunCorrectionApproval.findFirst({
      where: { id: approvalId, payrunId },
    });
    if (!row) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Correction approval not found for this payrun' });
    }
    return this.correctionApprovals.approve(approvalId, user.sub);
  }

  @Post(':payrun_id/correction-approvals/:approval_id/link-adjustment')
  @Permissions('payrun:adjust')
  @ApiOperation({ summary: 'Link the adjustment payrun that implements an approved correction' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'approval_id', example: 'ca_1' })
  async linkCorrectionAdjustment(
    @Param('payrun_id') payrunId: string,
    @Param('approval_id') approvalId: string,
    @Body() body: { adjustment_payrun_id: string },
    @CurrentUser() user: CurrentUserData,
  ) {
    await this.payrunsService.findOne(payrunId, user);
    if (!body?.adjustment_payrun_id) {
      throw new BadRequestException({
        code: 'ADJUSTMENT_PAYRUN_REQUIRED',
        message: 'adjustment_payrun_id is required',
      });
    }
    return this.correctionApprovals.linkAdjustmentPayrun(payrunId, approvalId, body.adjustment_payrun_id, user.sub);
  }
}
