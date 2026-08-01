import { Controller, Get, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OrgUnitManagerInferenceService } from './org-unit-manager-inference.service';

@Controller('workforce-org-manager-suggestions')
@UseGuards(AuthGuard('jwt'))
export class OrgUnitManagerInferenceController {
  constructor(private readonly service: OrgUnitManagerInferenceService) {}

  @Get()
  async listSuggestions(
    @Query('legalEntityId') legalEntityId?: string,
    @Query('orgUnitId') orgUnitId?: string,
    @Query('status') status?: string,
    @Query('confidenceBand') confidenceBand?: string,
  ) {
    return this.service.listSuggestions({ legalEntityId, orgUnitId, status, confidenceBand });
  }

  @Post('generate')
  async generateSuggestions() {
    return this.service.generateSuggestions();
  }

  @Post('reconcile')
  async reconcileStaleSuggestions() {
    const staled = await this.service.reconcileStaleSuggestions();
    return { status: 'ok', staled };
  }

  @Post(':id/accept')
  async acceptSuggestion(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';
    await this.service.acceptSuggestion(id, userId);
    return { status: 'ok', message: 'Suggestion accepted and manager assigned' };
  }

  @Post(':id/reject')
  async rejectSuggestion(@Param('id') id: string, @Req() req: any) {
    const userId = req.user?.sub ?? 'system';
    await this.service.rejectSuggestion(id, userId);
    return { status: 'ok', message: 'Suggestion rejected' };
  }

  @Post('bulk-accept')
  async bulkAccept(
    @Body('confidenceBand') confidenceBand: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? 'system';
    return this.service.bulkAccept({ confidenceBand }, userId);
  }

  @Get('metrics')
  async getMetrics() {
    return this.service.getMetrics();
  }

  @Post('assign-manual')
  async assignManual(
    @Body('orgUnitId') orgUnitId: string,
    @Body('employeeId') employeeId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.sub ?? 'system';
    await this.service.assignManagerManually(orgUnitId, employeeId, userId);
    return { status: 'ok', message: 'Manager assigned manually' };
  }
}
