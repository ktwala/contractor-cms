import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { UifService, UIFDeclarationSummary } from './services/uif.service';
import { SdlService, SDLDeclarationSummary } from './services/sdl.service';
import { CoidaService, COIDAAssessmentSummary } from './services/coida.service';
import { GarnishmentService, GarnishmentOrder } from './services/garnishment.service';
import { ComplianceDashboardService, ComplianceDashboardData } from './services/compliance-dashboard.service';

@ApiTags('Statutory Compliance')
@ApiBearerAuth('bearerAuth')
@Controller('api/compliance/statutory')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class StatutoryComplianceController {
  constructor(
    private readonly uifService: UifService,
    private readonly sdlService: SdlService,
    private readonly coidaService: CoidaService,
    private readonly garnishmentService: GarnishmentService,
    private readonly dashboardService: ComplianceDashboardService,
  ) {}

  // ============================================================================
  // Compliance Dashboard
  // ============================================================================

  @Get('dashboard/:legal_entity_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get compliance dashboard' })
  async getComplianceDashboard(
    @Param('legal_entity_id') legalEntityId: string,
  ): Promise<ComplianceDashboardData> {
    return this.dashboardService.getDashboard(legalEntityId);
  }

  @Put('checklist/:item_id')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Update checklist item' })
  async updateChecklistItem(
    @Param('item_id') itemId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.dashboardService.updateChecklistItem(
      itemId,
      body.status,
      req.user.userId,
      body.notes,
    );
    return { success: true };
  }

  @Post('alerts/:alert_id/acknowledge')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Acknowledge alert' })
  async acknowledgeAlert(
    @Param('alert_id') alertId: string,
    @Request() req: any,
  ) {
    await this.dashboardService.acknowledgeAlert(alertId, req.user.userId);
    return { success: true };
  }

  @Post('alerts/:alert_id/dismiss')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Dismiss alert' })
  async dismissAlert(@Param('alert_id') alertId: string) {
    await this.dashboardService.dismissAlert(alertId);
    return { success: true };
  }

  // ============================================================================
  // UIF (Unemployment Insurance Fund)
  // ============================================================================

  @Post('uif/declarations')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Generate UIF declaration' })
  async generateUifDeclaration(@Body() body: any, @Request() req: any) {
    const declarationId = await this.uifService.generateDeclaration(
      body.legal_entity_id,
      body.period,
      req.user.userId,
    );
    return { declaration_id: declarationId };
  }

  @Get('uif/declarations/:declaration_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get UIF declaration' })
  async getUifDeclaration(@Param('declaration_id') declarationId: string) {
    return this.uifService.getDeclaration(declarationId);
  }

  @Get('uif/declarations')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get UIF declarations' })
  async getUifDeclarations(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ): Promise<UIFDeclarationSummary[]> {
    return this.uifService.getDeclarations(legalEntityId, {
      period,
      status,
      limit,
    });
  }

  @Post('uif/declarations/:declaration_id/submit')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Submit UIF declaration' })
  async submitUifDeclaration(
    @Param('declaration_id') declarationId: string,
    @Request() req: any,
  ) {
    await this.uifService.submitDeclaration(declarationId, req.user.userId);
    return { success: true };
  }

  @Get('uif/declarations/:declaration_id/export')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Export UIF declaration to CSV' })
  async exportUifDeclaration(@Param('declaration_id') declarationId: string) {
    const csv = await this.uifService.exportToCSV(declarationId);
    return { csv };
  }

  @Delete('uif/declarations/:declaration_id')
  @Permissions('compliance:delete')
  @ApiOperation({ summary: 'Delete UIF declaration (draft only)' })
  async deleteUifDeclaration(
    @Param('declaration_id') declarationId: string,
    @Request() req: any,
  ) {
    await this.uifService.deleteDeclaration(declarationId, req.user.userId);
    return { success: true };
  }

  // ============================================================================
  // SDL (Skills Development Levy)
  // ============================================================================

  @Post('sdl/declarations')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Generate SDL declaration' })
  async generateSdlDeclaration(@Body() body: any, @Request() req: any) {
    const declarationId = await this.sdlService.generateDeclaration(
      body.legal_entity_id,
      body.period,
      req.user.userId,
    );
    return { declaration_id: declarationId };
  }

  @Get('sdl/declarations/:declaration_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get SDL declaration' })
  async getSdlDeclaration(@Param('declaration_id') declarationId: string) {
    return this.sdlService.getDeclaration(declarationId);
  }

  @Get('sdl/declarations')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get SDL declarations' })
  async getSdlDeclarations(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('period') period?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ): Promise<SDLDeclarationSummary[]> {
    return this.sdlService.getDeclarations(legalEntityId, {
      period,
      status,
      limit,
    });
  }

  @Post('sdl/declarations/:declaration_id/submit')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Submit SDL declaration' })
  async submitSdlDeclaration(
    @Param('declaration_id') declarationId: string,
    @Request() req: any,
  ) {
    await this.sdlService.submitDeclaration(declarationId, req.user.userId);
    return { success: true };
  }

  @Post('sdl/declarations/:declaration_id/payment')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Record SDL payment' })
  async recordSdlPayment(
    @Param('declaration_id') declarationId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.sdlService.recordPayment(
      declarationId,
      body.payment_reference,
      req.user.userId,
    );
    return { success: true };
  }

  @Get('sdl/declarations/:declaration_id/export')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Export SDL declaration to CSV' })
  async exportSdlDeclaration(@Param('declaration_id') declarationId: string) {
    const csv = await this.sdlService.exportToCSV(declarationId);
    return { csv };
  }

  @Delete('sdl/declarations/:declaration_id')
  @Permissions('compliance:delete')
  @ApiOperation({ summary: 'Delete SDL declaration (draft only)' })
  async deleteSdlDeclaration(
    @Param('declaration_id') declarationId: string,
    @Request() req: any,
  ) {
    await this.sdlService.deleteDeclaration(declarationId, req.user.userId);
    return { success: true };
  }

  // ============================================================================
  // COIDA (Compensation Fund)
  // ============================================================================

  @Post('coida/assessments')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Generate COIDA assessment' })
  async generateCoidaAssessment(@Body() body: any, @Request() req: any) {
    const assessmentId = await this.coidaService.generateAssessment(
      body.legal_entity_id,
      body.assessment_year,
      body.risk_class,
      body.tariff_rate,
      req.user.userId,
    );
    return { assessment_id: assessmentId };
  }

  @Get('coida/assessments/:assessment_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get COIDA assessment' })
  async getCoidaAssessment(@Param('assessment_id') assessmentId: string) {
    return this.coidaService.getAssessment(assessmentId);
  }

  @Get('coida/assessments')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get COIDA assessments' })
  async getCoidaAssessments(
    @Query('legal_entity_id') legalEntityId: string,
    @Query('year') year?: number,
    @Query('status') status?: string,
    @Query('limit') limit?: number,
  ): Promise<COIDAAssessmentSummary[]> {
    return this.coidaService.getAssessments(legalEntityId, {
      year,
      status,
      limit,
    });
  }

  @Post('coida/assessments/:assessment_id/submit')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Submit COIDA assessment' })
  async submitCoidaAssessment(
    @Param('assessment_id') assessmentId: string,
    @Request() req: any,
  ) {
    await this.coidaService.submitAssessment(assessmentId, req.user.userId);
    return { success: true };
  }

  @Post('coida/assessments/:assessment_id/payment')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Record COIDA payment' })
  async recordCoidaPayment(
    @Param('assessment_id') assessmentId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.coidaService.recordPayment(
      assessmentId,
      body.paid_amount,
      req.user.userId,
    );
    return { success: true };
  }

  @Get('coida/assessments/:assessment_id/export')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Export COIDA return of earnings to CSV' })
  async exportCoidaAssessment(@Param('assessment_id') assessmentId: string) {
    const csv = await this.coidaService.exportToCSV(assessmentId);
    return { csv };
  }

  @Delete('coida/assessments/:assessment_id')
  @Permissions('compliance:delete')
  @ApiOperation({ summary: 'Delete COIDA assessment (draft only)' })
  async deleteCoidaAssessment(
    @Param('assessment_id') assessmentId: string,
    @Request() req: any,
  ) {
    await this.coidaService.deleteAssessment(assessmentId, req.user.userId);
    return { success: true };
  }

  // ============================================================================
  // Garnishment Orders
  // ============================================================================

  @Post('garnishments')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Create garnishment order' })
  async createGarnishmentOrder(@Body() body: any, @Request() req: any) {
    const orderId = await this.garnishmentService.createGarnishmentOrder(
      body,
      req.user.userId,
    );
    return { order_id: orderId };
  }

  @Get('garnishments/:order_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get garnishment order' })
  async getGarnishmentOrder(@Param('order_id') orderId: string) {
    return this.garnishmentService.getOrder(orderId);
  }

  @Get('garnishments/employee/:employee_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get active garnishment orders for employee' })
  async getEmployeeGarnishments(@Param('employee_id') employeeId: string) {
    return this.garnishmentService.getActiveOrders(employeeId);
  }

  @Post('garnishments/:order_id/suspend')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Suspend garnishment order' })
  async suspendGarnishmentOrder(
    @Param('order_id') orderId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.garnishmentService.suspendOrder(
      orderId,
      body.reason,
      req.user.userId,
    );
    return { success: true };
  }

  @Post('garnishments/:order_id/reactivate')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Reactivate garnishment order' })
  async reactivateGarnishmentOrder(
    @Param('order_id') orderId: string,
    @Request() req: any,
  ) {
    await this.garnishmentService.reactivateOrder(orderId, req.user.userId);
    return { success: true };
  }

  @Post('garnishments/:order_id/cancel')
  @Permissions('compliance:write')
  @ApiOperation({ summary: 'Cancel garnishment order' })
  async cancelGarnishmentOrder(
    @Param('order_id') orderId: string,
    @Request() req: any,
  ) {
    await this.garnishmentService.cancelOrder(orderId, req.user.userId);
    return { success: true };
  }

  @Get('garnishments/summary/:legal_entity_id')
  @Permissions('compliance:read')
  @ApiOperation({ summary: 'Get garnishment summary' })
  async getGarnishmentSummary(
    @Param('legal_entity_id') legalEntityId: string,
  ) {
    return this.garnishmentService.getGarnishmentSummary(legalEntityId);
  }
}
