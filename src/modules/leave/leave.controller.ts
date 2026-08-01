import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeaveService } from './leave.service';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import {
  Country,
  LeaveRequestStatus,
  CreateLeaveRequestDto,
  ReviewLeaveRequestDto,
  CancelLeaveRequestDto,
  AdjustBalanceDto,
  RunAccrualDto,
  CalculateWorkingDaysDto,
  CalculateTerminationPayoutDto,
} from './dto/leave.dto';

@Controller('leave')
export class LeaveController {
  constructor(private readonly leaveService: LeaveService) {}

  // ============================================================================
  // LEAVE TYPES
  // ============================================================================

  @Get('types')
  @RequirePermissions('leave:read')
  async getLeaveTypes(
    @CurrentUser('organizationId') organizationId: string,
    @Query('country') country: Country,
  ): Promise<any[]> {
    return this.leaveService.getLeaveTypes(country, organizationId);
  }

  @Post('types/initialize')
  @RequirePermissions('leave:admin')
  async initializeLeaveTypes(
    @CurrentUser('organizationId') organizationId: string,
    @Body('country') country: Country,
  ): Promise<{ message: string }> {
    await this.leaveService.initializeLeaveTypesForCountry(country, organizationId);
    return { message: `Leave types initialized for ${country}` };
  }

  // ============================================================================
  // LEAVE BALANCES
  // ============================================================================

  @Get('balances/:employeeId')
  @RequirePermissions('leave:read')
  async getEmployeeBalances(
    @Param('employeeId') employeeId: string,
    @Query('asOfDate') asOfDate?: string,
  ): Promise<any[]> {
    return this.leaveService.getEmployeeBalances(
      employeeId,
      asOfDate ? new Date(asOfDate) : new Date(),
    );
  }

  @Post('balances/adjust')
  @RequirePermissions('leave:admin')
  async adjustBalance(
    @CurrentUser('sub') userId: string,
    @Body() dto: AdjustBalanceDto,
  ): Promise<{ message: string }> {
    await this.leaveService.adjustBalance(dto, userId);
    return { message: 'Balance adjusted successfully' };
  }

  // ============================================================================
  // LEAVE REQUESTS
  // ============================================================================

  @Post('requests/:employeeId')
  @RequirePermissions('leave:request')
  async createLeaveRequest(
    @CurrentUser('sub') userId: string,
    @Param('employeeId') employeeId: string,
    @Body() dto: CreateLeaveRequestDto,
  ): Promise<any> {
    return this.leaveService.createLeaveRequest(employeeId, dto, userId);
  }

  @Get('requests')
  @RequirePermissions('leave:read')
  async getLeaveRequests(
    @CurrentUser('organizationId') organizationId: string,
    @Query('employeeId') employeeId?: string,
    @Query('leaveTypeId') leaveTypeId?: string,
    @Query('status') status?: LeaveRequestStatus,
    @Query('startDateFrom') startDateFrom?: string,
    @Query('startDateTo') startDateTo?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ requests: any[]; total: number }> {
    return this.leaveService.getLeaveRequests(organizationId, {
      employeeId,
      leaveTypeId,
      status,
      startDateFrom: startDateFrom ? new Date(startDateFrom) : undefined,
      startDateTo: startDateTo ? new Date(startDateTo) : undefined,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Put('requests/:requestId/review')
  @RequirePermissions('leave:approve')
  async reviewLeaveRequest(
    @CurrentUser('sub') userId: string,
    @Param('requestId') requestId: string,
    @Body() dto: ReviewLeaveRequestDto,
  ): Promise<any> {
    return this.leaveService.reviewLeaveRequest(requestId, dto, userId);
  }

  @Put('requests/:requestId/cancel')
  @RequirePermissions('leave:request')
  async cancelLeaveRequest(
    @CurrentUser('sub') userId: string,
    @Param('requestId') requestId: string,
    @Body() dto: CancelLeaveRequestDto,
  ): Promise<any> {
    return this.leaveService.cancelLeaveRequest(requestId, dto, userId);
  }

  // ============================================================================
  // ACCRUALS
  // ============================================================================

  @Post('accruals/run')
  @RequirePermissions('leave:admin')
  async runAccruals(
    @CurrentUser('sub') userId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Body() dto: RunAccrualDto,
  ): Promise<any> {
    return this.leaveService.runAccruals(organizationId, dto, userId);
  }

  // ============================================================================
  // WORKING DAYS CALCULATION
  // ============================================================================

  @Post('calculate-working-days')
  @RequirePermissions('leave:read')
  async calculateWorkingDays(@Body() dto: CalculateWorkingDaysDto): Promise<any> {
    return this.leaveService.calculateWorkingDays(dto);
  }

  // ============================================================================
  // TERMINATION PAYOUT
  // ============================================================================

  @Post('termination-payout')
  @RequirePermissions('leave:admin')
  async calculateTerminationPayout(@Body() dto: CalculateTerminationPayoutDto): Promise<any> {
    return this.leaveService.calculateTerminationPayout(dto);
  }

  // ============================================================================
  // PUBLIC HOLIDAYS
  // ============================================================================

  @Get('public-holidays')
  @RequirePermissions('leave:read')
  async getPublicHolidays(
    @Query('country') country: Country,
    @Query('year') year: string,
  ): Promise<any[]> {
    return this.leaveService.getPublicHolidays(country, parseInt(year, 10));
  }

  @Post('public-holidays/seed')
  @RequirePermissions('leave:admin')
  async seedPublicHolidays(
    @Body('country') country: Country,
    @Body('year') year: number,
  ): Promise<{ message: string }> {
    await this.leaveService.seedPublicHolidays(country, year);
    return { message: `Public holidays seeded for ${country} ${year}` };
  }
}

// ============================================================================
// SELF-SERVICE CONTROLLER
// ============================================================================

@Controller('self-service/leave')
export class LeaveSelfServiceController {
  constructor(private readonly leaveService: LeaveService) {}

  @Get('balances')
  async getMyBalances(@CurrentUser('employeeId') employeeId: string): Promise<any[]> {
    if (!employeeId) {
      return [];
    }
    return this.leaveService.getEmployeeBalances(employeeId);
  }

  @Post('requests')
  async submitLeaveRequest(
    @CurrentUser('sub') userId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Body() dto: CreateLeaveRequestDto,
  ): Promise<any> {
    return this.leaveService.createLeaveRequest(employeeId, dto, userId);
  }

  @Get('requests')
  async getMyLeaveRequests(
    @CurrentUser('employeeId') employeeId: string,
    @CurrentUser('organizationId') organizationId: string,
    @Query('status') status?: LeaveRequestStatus,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ requests: any[]; total: number }> {
    return this.leaveService.getLeaveRequests(organizationId, {
      employeeId,
      status,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
    });
  }

  @Put('requests/:requestId/cancel')
  async cancelMyLeaveRequest(
    @CurrentUser('sub') userId: string,
    @CurrentUser('employeeId') employeeId: string,
    @Param('requestId') requestId: string,
    @Body() dto: CancelLeaveRequestDto,
  ): Promise<any> {
    // TODO: Verify the request belongs to the employee
    return this.leaveService.cancelLeaveRequest(requestId, dto, userId);
  }
}
