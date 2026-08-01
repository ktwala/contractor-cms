import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { BenefitPlansService, BenefitPlanDto, BenefitPlanOptionDto, BenefitRateDto } from './services/benefit-plans.service';
import { BenefitEnrollmentsService, CreateEnrollmentDto } from './services/benefit-enrollments.service';
import { BenefitCalculationsService } from './services/benefit-calculations.service';

@Controller('api/benefits')
@UseGuards(AuthGuard("jwt"), PermissionsGuard)
export class BenefitsController {
  constructor(
    private readonly benefitPlansService: BenefitPlansService,
    private readonly benefitEnrollmentsService: BenefitEnrollmentsService,
    private readonly benefitCalculationsService: BenefitCalculationsService,
  ) { }

  // =====================================================
  // BENEFIT PLANS
  // =====================================================

  @Post('plans')
  @RequirePermissions('benefit.plan.create')
  async createPlan(@Body() createDto: BenefitPlanDto, @Request() req: any) {
    return this.benefitPlansService.createPlan({
      ...createDto,
      createdBy: req.user.id,
    });
  }

  @Get('plans')
  @RequirePermissions('benefit.plan.view')
  async getAllPlans(@Query() query: any) {
    return this.benefitPlansService.getAllPlans({
      benefitType: query.benefit_type,
      isActive: query.is_active === 'true' ? true : query.is_active === 'false' ? false : undefined,
      isStatutory: query.is_statutory === 'true' ? true : query.is_statutory === 'false' ? false : undefined,
      providerName: query.provider_name,
    });
  }

  @Get('plans/:id')
  @RequirePermissions('benefit.plan.view')
  async getPlan(@Param('id') id: string) {
    return this.benefitPlansService.getPlanWithOptionsAndRates(id);
  }

  @Put('plans/:id')
  @RequirePermissions('benefit.plan.edit')
  async updatePlan(@Param('id') id: string, @Body() updateDto: Partial<BenefitPlanDto>) {
    return this.benefitPlansService.updatePlan(id, updateDto);
  }

  @Post('plans/:id/deactivate')
  @RequirePermissions('benefit.plan.edit')
  async deactivatePlan(@Param('id') id: string) {
    await this.benefitPlansService.deactivatePlan(id);
    return { message: 'Benefit plan deactivated successfully' };
  }

  @Post('plans/:id/activate')
  @RequirePermissions('benefit.plan.edit')
  async activatePlan(@Param('id') id: string) {
    await this.benefitPlansService.activatePlan(id);
    return { message: 'Benefit plan activated successfully' };
  }

  // =====================================================
  // PLAN OPTIONS
  // =====================================================

  @Post('plan-options')
  @RequirePermissions('benefit.plan.create')
  async createPlanOption(@Body() createDto: BenefitPlanOptionDto) {
    return this.benefitPlansService.createPlanOption(createDto);
  }

  @Get('plans/:planId/options')
  @RequirePermissions('benefit.plan.view')
  async getPlanOptions(@Param('planId') planId: string, @Query('active_only') activeOnly?: string) {
    return this.benefitPlansService.getPlanOptions(planId, activeOnly !== 'false');
  }

  // =====================================================
  // BENEFIT RATES
  // =====================================================

  @Post('rates')
  @RequirePermissions('benefit.plan.create')
  async createRate(@Body() createDto: BenefitRateDto) {
    return this.benefitPlansService.createRate(createDto);
  }

  @Get('plans/:planId/rates/current')
  @RequirePermissions('benefit.plan.view')
  async getCurrentRates(@Param('planId') planId: string, @Query('optionId') optionId?: string) {
    return this.benefitPlansService.getCurrentRates(planId, optionId);
  }

  // =====================================================
  // EMPLOYEE ENROLLMENTS
  // =====================================================

  @Post('enrollments')
  @RequirePermissions('benefit.enrollment.create')
  async createEnrollment(@Body() createDto: CreateEnrollmentDto, @Request() req: any) {
    return this.benefitEnrollmentsService.createEnrollment({
      ...createDto,
      createdBy: req.user.id,
    });
  }

  @Get('employees/:employeeId/enrollments')
  @RequirePermissions('benefit.enrollment.view')
  async getEmployeeEnrollments(
    @Param('employeeId') employeeId: string,
    @Query('active_only') activeOnly?: string
  ) {
    return this.benefitEnrollmentsService.getEmployeeEnrollments(employeeId, activeOnly !== 'false');
  }

  @Get('enrollments/:id')
  @RequirePermissions('benefit.enrollment.view')
  async getEnrollment(@Param('id') id: string) {
    const enrollment = await this.benefitEnrollmentsService.getEnrollmentById(id);
    const history = await this.benefitEnrollmentsService.getEnrollmentHistory(id);

    return { enrollment, history };
  }

  @Get('enrollments/pending/approvals')
  @RequirePermissions('benefit.enrollment.approve')
  async getPendingApprovals() {
    return this.benefitEnrollmentsService.getPendingApprovals();
  }

  @Post('enrollments/:id/approve')
  @RequirePermissions('benefit.enrollment.approve')
  async approveEnrollment(@Param('id') id: string, @Request() req: any) {
    return this.benefitEnrollmentsService.approveEnrollment(id, req.user.id);
  }

  @Post('enrollments/:id/verify-documents')
  @RequirePermissions('benefit.enrollment.approve')
  async verifyDocuments(@Param('id') id: string, @Request() req: any) {
    await this.benefitEnrollmentsService.verifyDocuments(id, req.user.id);
    return { message: 'Documents verified successfully' };
  }

  @Post('enrollments/:id/activate')
  @RequirePermissions('benefit.enrollment.approve')
  async activateEnrollment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.benefitEnrollmentsService.activateEnrollment(id, req.user.id, body.member_number);
  }

  @Post('enrollments/:id/cancel')
  @RequirePermissions('benefit.enrollment.cancel')
  async cancelEnrollment(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    if (!body.end_date) {
      throw new Error('end_date is required');
    }

    await this.benefitEnrollmentsService.cancelEnrollment(id, req.user.id, new Date(body.end_date));
    return { message: 'Enrollment cancelled successfully' };
  }

  // =====================================================
  // CALCULATIONS & REPORTING
  // =====================================================

  @Post('calculate-contribution')
  @RequirePermissions('benefit.enrollment.view')
  async calculateContribution(@Body() body: any) {
    const {
      enrollment_id,
      gross_salary,
      working_days,
      total_days_in_month,
      employee_age,
      dependent_count,
    } = body;

    const enrollment = await this.benefitEnrollmentsService.getEnrollmentById(enrollment_id);
    if (!enrollment) {
      throw new Error('Enrollment not found');
    }

    return this.benefitCalculationsService.calculateContribution(
      enrollment,
      gross_salary,
      working_days,
      total_days_in_month,
      employee_age,
      dependent_count
    );
  }

  @Get('reports/deduction-summary')
  @RequirePermissions('benefit.reports.view')
  async getDeductionSummary(@Query() query: any) {
    if (!query.period_start || !query.period_end) {
      throw new Error('period_start and period_end are required');
    }

    return this.benefitCalculationsService.getDeductionSummary(
      new Date(query.period_start),
      new Date(query.period_end)
    );
  }

  @Post('payroll/process-benefits')
  @RequirePermissions('benefit.enrollment.view')
  async processPayrollBenefits(@Body() body: any) {
    const {
      employee_id,
      payslip_id,
      gross_salary,
      period_start,
      period_end,
      working_days,
      total_days_in_month,
    } = body;

    return this.benefitCalculationsService.processPayrollBenefits(
      employee_id,
      payslip_id,
      gross_salary,
      new Date(period_start),
      new Date(period_end),
      working_days,
      total_days_in_month
    );
  }
}
