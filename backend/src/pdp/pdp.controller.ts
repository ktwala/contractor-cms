import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { PdpTelemetryService, PdpTelemetryResult } from './pdp.telemetry.service';
import { PdpActivationAdminService } from './pdp.activation.admin.service';
import { PdpExceptionService } from './pdp.exception.service';
import { CreateActivationRuleDto } from './dto/create-activation-rule.dto';
import { PreviewEvaluationDto } from './dto/preview-evaluation.dto';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { ApproveExceptionDto, RejectExceptionDto } from './dto/approve-exception.dto';
import { JwtAuthGuard } from '../core/auth/guards/jwt-auth.guard';
import { Permissions } from '../core/auth/decorators/permissions.decorator';
import { PermissionsGuard } from '../core/auth/guards/permissions.guard';
import { RequiresOrgContext } from '../core/auth/decorators/org-context.decorator';
import { PERMISSIONS } from '../core/auth/permissions.constants';

@Controller('pdp')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequiresOrgContext({ type: 'currentUser' })
export class PdpController {
  constructor(
    private readonly telemetryService: PdpTelemetryService,
    private readonly adminService: PdpActivationAdminService,
    private readonly exceptionService: PdpExceptionService
  ) {}

  // --- TELEMETRY ---
  @Get('telemetry')
  @Permissions(PERMISSIONS.PDP_ACTIVATION.VIEW)
  async getTelemetry(@Query('days') days?: string): Promise<PdpTelemetryResult> {
    const daysInt = days ? parseInt(days, 10) : 30;
    return this.telemetryService.getTelemetry(daysInt);
  }

  // --- ACTIVATION CONTROL PLANE ADMIN ---

  @Get('activation')
  @Permissions(PERMISSIONS.PDP_ACTIVATION.VIEW)
  async listRules() {
    return this.adminService.listRules();
  }

  @Post('activation')
  @Permissions(PERMISSIONS.PDP_ACTIVATION.MANAGE)
  async createRule(@Body() dto: CreateActivationRuleDto, @Request() req: any) {
    return this.adminService.createRule(dto, req.user.id);
  }

  @Put('activation/:id')
  @Permissions(PERMISSIONS.PDP_ACTIVATION.MANAGE)
  async updateRule(@Param('id') id: string, @Body() dto: CreateActivationRuleDto, @Request() req: any) {
    return this.adminService.updateRule(id, dto, req.user.id);
  }

  @Delete('activation/:id')
  @Permissions(PERMISSIONS.PDP_ACTIVATION.MANAGE)
  async disableRule(@Param('id') id: string, @Body('notes') notes: string, @Request() req: any) {
    return this.adminService.disableRule(id, req.user.id, notes);
  }

  @Post('activation/preview')
  @Permissions(PERMISSIONS.PDP_ACTIVATION.VIEW)
  async previewEvaluation(@Body() dto: PreviewEvaluationDto) {
    return this.adminService.previewEvaluation(dto);
  }

  // --- EXCEPTIONS WORKFLOW ---

  @Get('exceptions')
  @Permissions(PERMISSIONS.PDP_EXCEPTIONS.VIEW)
  async listExceptions(@Query('status') status?: string) {
    return this.exceptionService.listExceptions(status);
  }

  @Post('exceptions')
  @Permissions(PERMISSIONS.PDP_EXCEPTIONS.REQUEST)
  async createException(@Body() dto: CreateExceptionDto, @Request() req: any) {
    return this.exceptionService.createException(dto, req.user.id);
  }

  @Post('exceptions/:id/approve')
  @Permissions(PERMISSIONS.PDP_EXCEPTIONS.MANAGE)
  async approveException(@Param('id') id: string, @Body() dto: ApproveExceptionDto, @Request() req: any) {
    return this.exceptionService.approveException(id, dto, req.user.id);
  }

  @Post('exceptions/:id/reject')
  @Permissions(PERMISSIONS.PDP_EXCEPTIONS.MANAGE)
  async rejectException(@Param('id') id: string, @Body() dto: RejectExceptionDto, @Request() req: any) {
    return this.exceptionService.rejectException(id, dto, req.user.id);
  }
}
