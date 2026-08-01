import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkforceStatsService } from './workforce-stats.service';

@Controller('workforce-stats')
@UseGuards(AuthGuard('jwt'))
export class WorkforceStatsController {
  constructor(private readonly service: WorkforceStatsService) {}

  @Get('overview')
  async getOverviewStats() {
    return this.service.getOverviewStats();
  }

  @Get('legal-entities')
  async getLegalEntityStats(
    @Query('readinessStatus') readinessStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getLegalEntityStats({ readinessStatus, search });
  }

  @Get('org-units/tree')
  async getOrgUnitStatsTree(
    @Query('legalEntityId') legalEntityId?: string,
    @Query('missingManager') missingManager?: string,
    @Query('readinessStatus') readinessStatus?: string,
  ) {
    return this.service.getOrgUnitStatsTree({
      legalEntityId,
      missingManager: missingManager === 'true',
      readinessStatus,
    });
  }

  @Get('cost-centers')
  async getCostCenterStats(
    @Query('legalEntityId') legalEntityId?: string,
    @Query('usageStatus') usageStatus?: string,
    @Query('search') search?: string,
  ) {
    return this.service.getCostCenterStats({ legalEntityId, usageStatus, search });
  }

  @Get('manager-hierarchy')
  async getManagerHierarchyStats() {
    return this.service.getManagerHierarchyStats();
  }

  @Get('hr-export')
  async getHrExportStats() {
    return this.service.getHrExportStats();
  }

  @Post('refresh')
  async triggerRefresh() {
    await this.service.refreshAllSnapshots();
    return { status: 'ok', message: 'Snapshot refresh complete' };
  }
}
