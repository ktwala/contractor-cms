import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuditInsightsService } from './audit-insights.service';
import { AuditInsightsResponseDto } from './dto/audit-insights.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { RequiresOrgContext } from '../auth/decorators/org-context.decorator';
import { CurrentAccessContext } from '../auth/decorators/current-access-context.decorator';
import { AccessContext } from '../auth/interfaces/access-context.interface';

@ApiTags('audit-insights')
@Controller('settings/audit-insights')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@ApiBearerAuth()
export class AuditInsightsController {
  constructor(private readonly auditInsightsService: AuditInsightsService) {}

  @Get()
  @Permissions('audit:read')
  @RequiresOrgContext({ type: 'currentUser' })
  @ApiOperation({ summary: 'Get comprehensive audit-driven insights' })
  @ApiResponse({
    status: 200,
    description: 'Insights retrieved successfully',
    type: AuditInsightsResponseDto,
  })
  async getInsights(
    @CurrentAccessContext() accessContext: AccessContext,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<AuditInsightsResponseDto> {
    return this.auditInsightsService.getDashboardInsights(
      accessContext,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
