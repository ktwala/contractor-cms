import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { HierarchyIntelligenceService } from './hierarchy-intelligence.service';

@Controller('enterprise/employees')
@UseGuards(AuthGuard('jwt'))
export class HierarchyIntelligenceController {
  constructor(private readonly service: HierarchyIntelligenceService) {}

  @Get(':employeeId/team/summary')
  async getTeamSummary(@Param('employeeId') employeeId: string) {
    return this.service.getTeamSummary(employeeId);
  }

  @Get(':employeeId/team/direct-reports')
  async getDirectReports(@Param('employeeId') employeeId: string) {
    return this.service.getDirectReports(employeeId);
  }

  @Get(':employeeId/team/tree')
  async getTeamTree(
    @Param('employeeId') employeeId: string,
    @Query('maxDepth') maxDepth?: string,
  ) {
    return this.service.getTeamTree(employeeId, maxDepth ? parseInt(maxDepth, 10) : 3);
  }

  @Get(':employeeId/team/flat')
  async getFlatTeam(@Param('employeeId') employeeId: string) {
    return this.service.getFlatTeam(employeeId);
  }
}
