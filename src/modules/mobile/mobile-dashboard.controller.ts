import { Controller, Get, Put, Body, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';

@ApiTags('Mobile - Dashboard')
@ApiBearerAuth('bearerAuth')
@Controller('api/mobile/dashboard')
@UseGuards(AuthGuard('jwt'))
export class MobileDashboardController {
  constructor(private readonly prisma: PrismaService) { }

  @Get('summary')
  @ApiOperation({ summary: 'Get mobile dashboard summary' })
  async getDashboardSummary(@Request() req: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const [attendance, leave, shifts, payslip, approvals, notifications] = await Promise.all([
      this.getAttendanceSummary(user.employeeId),
      this.getLeaveBalance(user.employeeId),
      this.getUpcomingShifts(user.employeeId),
      this.getRecentPayslip(user.employeeId),
      this.getPendingApprovals(user.employeeId),
      this.getUnreadNotifications(userId),
    ]);

    return { attendance, leave, shifts, payslip, approvals, notifications };
  }

  @Get('quick-stats')
  @ApiOperation({ summary: 'Get quick stats' })
  async getQuickStats(@Request() req: any) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return { error: 'Employee not found' };

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [attendanceRecords, leaveBalance, unread, pending] = await Promise.all([
      (this.prisma as any).attendanceRecord.findMany({
        where: { employeeId: user.employeeId, clockInTime: { gte: monthStart }, clockOutTime: { not: null } },
      }),
      (this.prisma as any).leaveBalance.aggregate({
        where: { employeeId: user.employeeId, leaveYear: now.getFullYear() },
        _sum: { totalDays: true, usedDays: true },
      }),
      (this.prisma as any).inAppNotification.count({ where: { userId, isRead: false, isArchived: false } }),
      this.getPendingApprovals(user.employeeId),
    ]);

    const daysPresent = new Set(attendanceRecords.map((r: any) => r.workDate?.toISOString().split('T')[0])).size;
    const totalHours = attendanceRecords.reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0);

    return {
      attendance: { days_present: daysPresent, total_hours: Math.round(totalHours * 10) / 10 },
      leave: { total: leaveBalance._sum?.totalDays || 0, used: leaveBalance._sum?.usedDays || 0, remaining: (leaveBalance._sum?.totalDays || 0) - (leaveBalance._sum?.usedDays || 0) },
      notifications: unread,
      pending_approvals: pending.total,
    };
  }

  @Get('recent-activities')
  @ApiOperation({ summary: 'Get recent activities' })
  async getRecentActivities(@Request() req: any, @Query('limit') limit = 20) {
    const userId = req.user.userId;
    const user = await (this.prisma as any).user.findUnique({ where: { id: userId }, select: { employeeId: true } });
    if (!user?.employeeId) return [];

    const [clock, leave, expenses] = await Promise.all([
      (this.prisma as any).attendanceRecord.findMany({
        where: { employeeId: user.employeeId },
        orderBy: { clockInTime: 'desc' },
        take: 10,
        select: { clockInTime: true },
      }),
      (this.prisma as any).leaveRequest.findMany({
        where: { employeeId: user.employeeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { createdAt: true, leaveType: true, status: true, startDate: true, endDate: true },
      }),
      (this.prisma as any).expenseClaim.findMany({
        where: { employeeId: user.employeeId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { createdAt: true, status: true, totalAmount: true },
      }),
    ]);

    const activities = [
      ...clock.map((c: any) => ({ type: 'clock', timestamp: c.clockInTime, action: 'Clocked in' })),
      ...leave.map((l: any) => ({ type: 'leave', timestamp: l.createdAt, action: `${l.leaveType} request ${l.status}` })),
      ...expenses.map((e: any) => ({ type: 'expense', timestamp: e.createdAt, action: `Expense claim ${e.status}`, details: `R${e.totalAmount}` })),
    ];

    return activities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, parseInt(String(limit)));
  }

  @Get('widgets')
  @ApiOperation({ summary: 'Get dashboard widgets configuration' })
  async getWidgets(@Request() req: any) {
    const userId = req.user.userId;
    const settings = await (this.prisma as any).mobileAppSetting.findFirst({
      where: { userId, settingKey: 'dashboard_widgets' },
      orderBy: { createdAt: 'desc' },
    });

    if (settings?.settingValue) return settings.settingValue;

    return {
      widgets: [
        { id: 'attendance_summary', enabled: true, order: 1 },
        { id: 'upcoming_shifts', enabled: true, order: 2 },
        { id: 'leave_balance', enabled: true, order: 3 },
        { id: 'recent_payslips', enabled: true, order: 4 },
        { id: 'quick_actions', enabled: true, order: 5 },
      ]
    };
  }

  @Put('widgets')
  @ApiOperation({ summary: 'Update dashboard widgets configuration' })
  async updateWidgets(@Request() req: any, @Body() config: any) {
    const userId = req.user.userId;
    const deviceId = req.user.deviceId;

    await (this.prisma as any).mobileAppSetting.deleteMany({ where: { userId, settingKey: 'dashboard_widgets' } });
    await (this.prisma as any).mobileAppSetting.create({ data: { userId, deviceId, settingKey: 'dashboard_widgets', settingValue: config } });

    return { success: true };
  }

  private async getAttendanceSummary(employeeId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const records = await (this.prisma as any).attendanceRecord.findMany({
      where: { employeeId, clockInTime: { gte: monthStart } },
    });

    return {
      days_present: new Set(records.map((r: any) => r.workDate?.toISOString().split('T')[0])).size,
      total_hours: Math.round(records.reduce((sum: number, r: any) => sum + (r.hoursWorked || 0), 0) * 10) / 10,
      late_count: records.filter((r: any) => r.lateByMinutes > 0).length,
    };
  }

  private async getLeaveBalance(employeeId: string) {
    return (this.prisma as any).leaveBalance.findMany({
      where: { employeeId, leaveYear: new Date().getFullYear() },
      orderBy: { leaveType: 'asc' },
    });
  }

  private async getUpcomingShifts(employeeId: string) {
    return (this.prisma as any).shiftAssignment.findMany({
      where: { employeeId, workDate: { gte: new Date() } },
      include: { shift: true },
      orderBy: { workDate: 'asc' },
      take: 5,
    });
  }

  private async getRecentPayslip(employeeId: string) {
    return (this.prisma as any).paySlip.findFirst({
      where: { employeeId },
      include: { payRun: { select: { payDate: true, status: true } } },
      orderBy: { payRun: { payDate: 'desc' } },
    });
  }

  private async getPendingApprovals(employeeId: string) {
    const [leave, expenses, loans] = await Promise.all([
      (this.prisma as any).leaveRequest.count({ where: { employeeId, status: 'pending' } }),
      (this.prisma as any).expenseClaim.count({ where: { employeeId, status: { in: ['submitted', 'under_review'] } } }),
      (this.prisma as any).loanApplication.count({ where: { employeeId, status: { in: ['submitted', 'under_review'] } } }),
    ]);

    return { leave, expenses, loans, total: leave + expenses + loans };
  }

  private async getUnreadNotifications(userId: string) {
    return (this.prisma as any).inAppNotification.count({ where: { userId, isRead: false, isArchived: false } });
  }
}
