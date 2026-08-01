import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { TimeAttendanceService } from './services/time-attendance.service';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Time & Attendance')
@ApiBearerAuth('bearerAuth')
@Controller('api/time-attendance')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TimeAttendanceController {
  constructor(private readonly timeAttendanceService: TimeAttendanceService) {}

  // ==================== CLOCK IN/OUT ====================

  @Post('clock-in')
  @Permissions('time_attendance:clock:write')
  @ApiOperation({ summary: 'Clock in for the day' })
  @ApiResponse({ status: 201, description: 'Clocked in successfully' })
  async clockIn(@Request() req: any, @Body() body: { location?: string; device_type?: string }) {
    return this.timeAttendanceService.clockIn(req.user.id, {
      location: body.location,
      ip: req.ip,
      device_type: body.device_type,
    });
  }

  @Post('clock-out')
  @Permissions('time_attendance:clock:write')
  @ApiOperation({ summary: 'Clock out for the day' })
  @ApiResponse({ status: 201, description: 'Clocked out successfully' })
  async clockOut(@Request() req: any, @Body() body: { location?: string }) {
    return this.timeAttendanceService.clockOut(req.user.id, {
      location: body.location,
      ip: req.ip,
    });
  }

  @Get('status')
  @Permissions('time_attendance:status:read')
  @ApiOperation({ summary: 'Get current attendance status' })
  @ApiResponse({ status: 200, description: 'Attendance status' })
  async getStatus(@Request() req: any) {
    return this.timeAttendanceService.getAttendanceStatus(req.user.id);
  }

  // ==================== ATTENDANCE RECORDS ====================

  @Get('attendance/:employee_id')
  @Permissions('time_attendance:attendance:read')
  @ApiOperation({ summary: 'Get attendance records for employee' })
  @ApiQuery({ name: 'date_from', required: false })
  @ApiQuery({ name: 'date_to', required: false })
  @ApiResponse({ status: 200, description: 'Attendance records' })
  async getAttendance(
    @Param('employee_id') employeeId: string,
    @Query('date_from') dateFrom?: string,
    @Query('date_to') dateTo?: string,
  ) {
    return this.timeAttendanceService.getAttendanceRecords(employeeId, {
      date_from: dateFrom,
      date_to: dateTo,
    });
  }

  @Get('summary/:employee_id/:month')
  @Permissions('time_attendance:summary:read')
  @ApiOperation({ summary: 'Get attendance summary for month' })
  @ApiResponse({ status: 200, description: 'Attendance summary' })
  async getSummary(
    @Param('employee_id') employeeId: string,
    @Param('month') month: string,
  ) {
    return this.timeAttendanceService.getAttendanceSummary(employeeId, month);
  }

  // ==================== SHIFTS ====================

  @Get('shifts')
  @Permissions('time_attendance:shifts:read')
  @ApiOperation({ summary: 'Get all shifts' })
  @ApiQuery({ name: 'is_active', required: false, type: Boolean })
  @ApiQuery({ name: 'country', required: false })
  @ApiResponse({ status: 200, description: 'List of shifts' })
  async getShifts(
    @Query('is_active') isActive?: boolean,
    @Query('country') country?: string,
  ) {
    return this.timeAttendanceService.getShifts({
      is_active: isActive,
      country,
    });
  }

  @Post('shifts')
  @Permissions('time_attendance:shifts:create')
  @ApiOperation({ summary: 'Create new shift' })
  @ApiResponse({ status: 201, description: 'Shift created' })
  async createShift(@Body() body: any) {
    return this.timeAttendanceService.createShift(body);
  }

  @Post('shifts/assign')
  @Permissions('time_attendance:shifts:assign')
  @ApiOperation({ summary: 'Assign shift to employee' })
  @ApiResponse({ status: 201, description: 'Shift assigned' })
  async assignShift(@Body() body: { employee_id: string; shift_id: string; effective_from: string; work_days?: number[] }) {
    return this.timeAttendanceService.assignShift(
      body.employee_id,
      body.shift_id,
      {
        effective_from: body.effective_from,
        work_days: body.work_days,
        created_by: 'admin', // TODO: Get from auth context
      }
    );
  }

  // ==================== OVERTIME ====================

  @Post('overtime/request')
  @Permissions('time_attendance:overtime:request')
  @ApiOperation({ summary: 'Request overtime' })
  @ApiResponse({ status: 201, description: 'Overtime requested' })
  async requestOvertime(@Request() req: any, @Body() body: any) {
    return this.timeAttendanceService.requestOvertime({
      ...body,
      requested_by: req.user.id,
    });
  }

  @Post('overtime/:id/approve')
  @Permissions('time_attendance:overtime:approve')
  @ApiOperation({ summary: 'Approve overtime request' })
  @ApiResponse({ status: 200, description: 'Overtime approved' })
  async approveOvertime(@Request() req: any, @Param('id') id: string) {
    await this.timeAttendanceService.approveOvertime(id, req.user.id);
    return { success: true };
  }
}
