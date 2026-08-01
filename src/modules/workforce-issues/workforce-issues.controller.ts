import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WorkforceIssuesService } from './workforce-issues.service';
import { WorkforceIssueEntityType, WorkforceIssueType, WorkforceIssueSeverity } from '@prisma/client';

@Controller('workforce-issues')
@UseGuards(AuthGuard('jwt'))
export class WorkforceIssuesController {
  constructor(private readonly service: WorkforceIssuesService) {}

  @Get()
  async listIssues(
    @Query('entityType') entityType?: WorkforceIssueEntityType,
    @Query('issueType') issueType?: WorkforceIssueType,
    @Query('severity') severity?: WorkforceIssueSeverity,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('orgUnitId') orgUnitId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('blocksExport') blocksExport?: string,
    @Query('resolved') resolved?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.listIssues({
      entityType,
      issueType,
      severity,
      legalEntityId,
      orgUnitId,
      employeeId,
      blocksExport: blocksExport === 'true' ? true : blocksExport === 'false' ? false : undefined,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Get('counts')
  async getIssueCounts() {
    return this.service.getIssueCounts();
  }

  @Get('grouped')
  async getGroupedIssues(
    @Query('issueType') issueType?: WorkforceIssueType,
    @Query('groupBy') groupBy?: string,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('resolved') resolved?: string,
  ) {
    return this.service.getGroupedIssues({
      issueType,
      groupBy: (groupBy as any) || 'issueType',
      legalEntityId,
      resolved: resolved === 'true' ? true : resolved === 'false' ? false : undefined,
    });
  }

  @Get('queue-stats')
  async getQueueStats() {
    return this.service.getQueueStats();
  }

  @Get('queue')
  async getRemediationQueue(
    @Query('issueType') issueType?: WorkforceIssueType,
    @Query('legalEntityId') legalEntityId?: string,
    @Query('orgUnitId') orgUnitId?: string,
    @Query('severity') severity?: WorkforceIssueSeverity,
    @Query('assignedUserId') assignedUserId?: string,
    @Query('blocksExport') blocksExport?: string,
    @Query('sortBy') sortBy?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.service.getRemediationQueue({
      issueType,
      legalEntityId,
      orgUnitId,
      severity,
      assignedUserId,
      blocksExport: blocksExport === 'true' ? true : blocksExport === 'false' ? false : undefined,
      sortBy: (sortBy as any) || 'priority',
      limit: limit ? parseInt(limit, 10) : undefined,
      offset: offset ? parseInt(offset, 10) : undefined,
    });
  }

  @Post(':id/assign')
  async assignIssue(@Param('id') id: string, @Body('assignedUserId') assignedUserId: string) {
    return this.service.assignIssue(id, assignedUserId);
  }

  @Post(':id/unassign')
  async unassignIssue(@Param('id') id: string) {
    return this.service.unassignIssue(id);
  }

  @Post('detect')
  async runDetection() {
    return this.service.detectAllIssues();
  }

  @Post(':id/resolve')
  async resolveIssue(
    @Param('id') id: string,
    @Req() req: any,
    @Body('resolutionNote') resolutionNote?: string,
  ) {
    const userId = req.user?.id ?? 'system';
    return this.service.resolveIssue(id, userId, resolutionNote);
  }

  @Post(':id/reopen')
  async reopenIssue(@Param('id') id: string) {
    return this.service.reopenIssue(id);
  }
}
