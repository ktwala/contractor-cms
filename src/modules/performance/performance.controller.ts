import { Controller, Get, Post, Put, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { PerformanceService } from './services/performance.service';

@Controller('api/performance')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class PerformanceController {
  constructor(private readonly performanceService: PerformanceService) {}

  // ==================== CYCLES ====================

  @Get('cycles')
  async getCycles(@Query('status') status?: string, @Query('country') country?: string) {
    return this.performanceService.findAllCycles({ status, country });
  }

  @Post('cycles')
  @RequirePermissions('performance.cycle.create')
  async createCycle(@Body() body: any, @Request() req: any) {
    return this.performanceService.createCycle({ ...body, created_by: req.user.id });
  }

  @Post('cycles/:id/activate')
  @RequirePermissions('performance.cycle.activate')
  async activateCycle(@Param('id') id: string) {
    await this.performanceService.activateCycle(id);
    return { message: 'Cycle activated successfully' };
  }

  @Get('cycles/:id/stats')
  async getCycleStats(@Param('id') id: string) {
    return this.performanceService.getCycleStatistics(id);
  }

  // ==================== GOALS ====================

  @Get('goals')
  async getGoals(
    @Query('employee_id') employeeId?: string,
    @Query('cycle_id') cycleId?: string,
    @Query('status') status?: string
  ) {
    return this.performanceService.findGoals({ employee_id: employeeId, cycle_id: cycleId, status });
  }

  @Post('goals')
  async createGoal(@Body() body: any) {
    return this.performanceService.createGoal(body);
  }

  @Put('goals/:id/progress')
  async updateGoalProgress(@Param('id') id: string, @Body() body: any) {
    await this.performanceService.updateGoalProgress(id, body);
    return { message: 'Goal progress updated successfully' };
  }

  // ==================== REVIEWS ====================

  @Get('reviews')
  async getReviews(
    @Query('employee_id') employeeId?: string,
    @Query('manager_id') managerId?: string,
    @Query('cycle_id') cycleId?: string,
    @Query('status') status?: string
  ) {
    return this.performanceService.findReviews({
      employee_id: employeeId,
      manager_id: managerId,
      cycle_id: cycleId,
      status
    });
  }

  @Post('reviews')
  @RequirePermissions('performance.review.create')
  async createReview(@Body() body: any) {
    return this.performanceService.createReview(body);
  }

  @Post('reviews/:id/self-assessment')
  async submitSelfAssessment(@Param('id') id: string, @Body() body: any) {
    await this.performanceService.submitSelfAssessment(id, body);
    return { message: 'Self-assessment submitted successfully' };
  }

  @Post('reviews/:id/manager-review')
  @RequirePermissions('performance.review.submit')
  async submitManagerReview(@Param('id') id: string, @Body() body: any) {
    await this.performanceService.submitManagerReview(id, body);
    return { message: 'Manager review submitted successfully' };
  }

  // ==================== FEEDBACK ====================

  @Post('feedback/request')
  async requestPeerFeedback(@Body() body: any) {
    const id = await this.performanceService.requestPeerFeedback(body);
    return { id, message: 'Feedback request sent successfully' };
  }

  @Post('feedback/:id/submit')
  async submitPeerFeedback(@Param('id') id: string, @Body() body: any) {
    await this.performanceService.submitPeerFeedback(id, body);
    return { message: 'Feedback submitted successfully' };
  }

  @Get('feedback/pending')
  async getPendingFeedback(@Request() req: any) {
    return this.performanceService.findPendingFeedback(req.user.id);
  }

  // ==================== STATISTICS ====================

  @Get('stats/employee/:id')
  async getEmployeeStats(@Param('id') id: string) {
    return this.performanceService.getEmployeeStatistics(id);
  }
}
