import { Controller, Get, Post, Body, Param, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';

interface ClockInData { latitude?: number; longitude?: number; accuracy?: number; note?: string; }
interface ClockOutData { latitude?: number; longitude?: number; accuracy?: number; note?: string; }

@ApiTags('Mobile - Timesheet')
@ApiBearerAuth('bearerAuth')
@Controller('api/mobile/timesheet')
@UseGuards(AuthGuard('jwt'))
export class MobileTimesheetController {
  constructor(private readonly prisma: PrismaService) { }

  @Get('status')
  @ApiOperation({ summary: 'Get current clock in/out status' })
  async getClockStatus(@Request() req: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const activeRecord = await (this.prisma as any).attendanceRecord.findFirst({
      where: { employeeId: user.employeeId, clockOutTime: null },
      include: { shift: true },
      orderBy: { clockInTime: 'desc' },
    });

    if (activeRecord) {
      const hoursWorked = (Date.now() - new Date(activeRecord.clockInTime).getTime()) / (1000 * 60 * 60);
      return {
        is_clocked_in: true,
        clock_in_time: activeRecord.clockInTime,
        hours_worked: Math.round(hoursWorked * 100) / 100,
        shift_name: activeRecord.shift?.shiftName,
        location: { latitude: activeRecord.clockInLatitude, longitude: activeRecord.clockInLongitude },
      };
    }

    const todayShift = await (this.prisma as any).shiftAssignment.findFirst({
      where: { employeeId: user.employeeId, workDate: new Date() },
      include: { shift: true },
    });

    return { is_clocked_in: false, today_shift: todayShift?.shift || null };
  }

  @Post('clock-in')
  @ApiOperation({ summary: 'Clock in' })
  async clockIn(@Request() req: any, @Body() data: ClockInData) {
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) throw new BadRequestException('Employee not found');

    const activeRecord = await (this.prisma as any).attendanceRecord.findFirst({
      where: { employeeId: user.employeeId, clockOutTime: null },
    });
    if (activeRecord) throw new BadRequestException('Already clocked in');

    const shiftAssignment = await (this.prisma as any).shiftAssignment.findFirst({
      where: { employeeId: user.employeeId, workDate: new Date() },
      include: { shift: true },
    });

    let lateByMinutes = 0;
    if (shiftAssignment?.shift?.startTime) {
      const now = new Date();
      const [hours, minutes] = shiftAssignment.shift.startTime.split(':').map(Number);
      const shiftStart = new Date(now); shiftStart.setHours(hours, minutes, 0, 0);
      const grace = shiftAssignment.shift.gracePeriodMinutes || 0;
      const diff = Math.floor((now.getTime() - shiftStart.getTime()) / 60000);
      if (diff > grace) lateByMinutes = diff - grace;
    }

    const record = await (this.prisma as any).attendanceRecord.create({
      data: {
        employeeId: user.employeeId,
        shiftAssignmentId: shiftAssignment?.id,
        workDate: new Date(),
        clockInTime: new Date(),
        clockInLatitude: data.latitude,
        clockInLongitude: data.longitude,
        clockInAccuracy: data.accuracy,
        clockInDeviceId: deviceId,
        lateByMinutes,
        notes: data.note,
      },
    });

    await (this.prisma as any).clockEvent.create({
      data: { employeeId: user.employeeId, attendanceRecordId: record.id, eventType: 'clock_in', eventTime: new Date(), latitude: data.latitude, longitude: data.longitude, deviceId },
    });

    return { success: true, record_id: record.id, clock_in_time: record.clockInTime, late_by_minutes: lateByMinutes };
  }

  @Post('clock-out')
  @ApiOperation({ summary: 'Clock out' })
  async clockOut(@Request() req: any, @Body() data: ClockOutData) {
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) throw new BadRequestException('Employee not found');

    const record = await (this.prisma as any).attendanceRecord.findFirst({
      where: { employeeId: user.employeeId, clockOutTime: null },
      include: { shift: true },
      orderBy: { clockInTime: 'desc' },
    });
    if (!record) throw new BadRequestException('Not clocked in');

    const clockOut = new Date();
    const clockIn = new Date(record.clockInTime);
    const totalMinutes = Math.floor((clockOut.getTime() - clockIn.getTime()) / 60000);
    const breakMinutes = record.shift?.breakDurationMinutes || 0;
    const hoursWorked = (totalMinutes - breakMinutes) / 60;

    let earlyDeparture = 0;
    if (record.shift?.endTime) {
      const [h, m] = record.shift.endTime.split(':').map(Number);
      const shiftEnd = new Date(clockOut); shiftEnd.setHours(h, m, 0, 0);
      if (shiftEnd.getTime() > clockOut.getTime()) earlyDeparture = Math.floor((shiftEnd.getTime() - clockOut.getTime()) / 60000);
    }

    await (this.prisma as any).attendanceRecord.update({
      where: { id: record.id },
      data: { clockOutTime: clockOut, clockOutLatitude: data.latitude, clockOutLongitude: data.longitude, clockOutAccuracy: data.accuracy, clockOutDeviceId: deviceId, hoursWorked, earlyDepartureMinutes: earlyDeparture },
    });

    await (this.prisma as any).clockEvent.create({
      data: { employeeId: user.employeeId, attendanceRecordId: record.id, eventType: 'clock_out', eventTime: clockOut, latitude: data.latitude, longitude: data.longitude, deviceId },
    });

    return { success: true, record_id: record.id, clock_in_time: clockIn, clock_out_time: clockOut, hours_worked: Math.round(hoursWorked * 100) / 100, early_departure_minutes: earlyDeparture };
  }

  @Get('attendance')
  @ApiOperation({ summary: 'Get attendance history' })
  async getAttendanceHistory(@Request() req: any, @Query('month') month?: string, @Query('year') year?: string, @Query('limit') limit = 30) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    const where: any = { employeeId: user.employeeId };
    if (month && year) {
      const start = new Date(parseInt(year), parseInt(month) - 1, 1);
      const end = new Date(parseInt(year), parseInt(month), 0);
      where.workDate = { gte: start, lte: end };
    }

    return (this.prisma as any).attendanceRecord.findMany({
      where,
      include: { shift: { select: { shiftName: true, shiftType: true } } },
      orderBy: [{ workDate: 'desc' }, { clockInTime: 'desc' }],
      take: parseInt(String(limit)),
    });
  }

  @Get('attendance/summary/:year/:month')
  @ApiOperation({ summary: 'Get monthly attendance summary' })
  async getMonthlyAttendanceSummary(@Request() req: any, @Param('year') year: string, @Param('month') month: string) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const start = new Date(parseInt(year), parseInt(month) - 1, 1);
    const end = new Date(parseInt(year), parseInt(month), 0);

    const records = await (this.prisma as any).attendanceRecord.findMany({
      where: { employeeId: user.employeeId, workDate: { gte: start, lte: end } },
    });

    const daysWorked = new Set(records.map((r: any) => r.workDate?.toISOString().split('T')[0])).size;
    const totalHours = records.reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0);
    const lateDays = records.filter((r: any) => r.lateByMinutes > 0).length;

    return { days_worked: daysWorked, total_hours: totalHours, late_days: lateDays };
  }

  @Get('shifts/upcoming')
  @ApiOperation({ summary: 'Get upcoming shifts' })
  async getUpcomingShifts(@Request() req: any, @Query('days') days = 7) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    const end = new Date(); end.setDate(end.getDate() + parseInt(String(days)));

    return (this.prisma as any).shiftAssignment.findMany({
      where: { employeeId: user.employeeId, workDate: { gte: new Date(), lte: end } },
      include: { shift: true },
      orderBy: { workDate: 'asc' },
    });
  }

  @Post('overtime/request')
  @ApiOperation({ summary: 'Request overtime approval' })
  async requestOvertime(@Request() req: any, @Body() data: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) throw new BadRequestException('Employee not found');

    const request = await (this.prisma as any).overtimeRequest.create({
      data: { employeeId: user.employeeId, requestDate: new Date(data.request_date), overtimeHours: data.hours, reason: data.reason, status: 'pending' },
    });

    return { success: true, request_id: request.id };
  }

  @Get('overtime/requests')
  @ApiOperation({ summary: 'Get overtime requests' })
  async getOvertimeRequests(@Request() req: any, @Query('status') status?: string, @Query('limit') limit = 20) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    return (this.prisma as any).overtimeRequest.findMany({
      where: { employeeId: user.employeeId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
      take: parseInt(String(limit)),
    });
  }
}
