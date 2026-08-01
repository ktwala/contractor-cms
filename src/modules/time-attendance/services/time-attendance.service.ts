import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class TimeAttendanceService {
  constructor(private readonly prisma: PrismaService) { }

  async clockIn(employeeId: string, data?: { location?: string; ip?: string; device_type?: string }) {
    const today = new Date().toISOString().split('T')[0];

    const existing = await (this.prisma as any).attendanceRecord.findFirst({
      where: { employeeId, attendanceDate: new Date(today) },
    });

    if (existing?.clockInTime) throw new Error('Already clocked in today');

    const shift = await this.getEmployeeShift(employeeId);
    const clockInTime = new Date();

    let record;
    if (!existing) {
      record = await (this.prisma as any).attendanceRecord.create({
        data: {
          employeeId,
          attendanceDate: new Date(today),
          shiftId: shift?.id,
          clockInTime,
          clockInLocation: data?.location,
          clockInIp: data?.ip,
          status: 'present',
        },
      });
    } else {
      record = await (this.prisma as any).attendanceRecord.update({
        where: { id: existing.id },
        data: { clockInTime, clockInLocation: data?.location, clockInIp: data?.ip },
      });
    }

    await this.logClockEvent(employeeId, record.id, 'clock_in', clockInTime, data);
    if (shift) await this.calculateLateness(record.id, clockInTime, shift);

    return { success: true, record_id: record.id, clock_in_time: clockInTime };
  }

  async clockOut(employeeId: string, data?: { location?: string; ip?: string }) {
    const today = new Date().toISOString().split('T')[0];

    const record = await (this.prisma as any).attendanceRecord.findFirst({
      where: { employeeId, attendanceDate: new Date(today) },
    });

    if (!record?.clockInTime) throw new Error('Must clock in first');

    const clockOutTime = new Date();
    const clockIn = new Date(record.clockInTime);
    const totalMinutes = Math.floor((clockOutTime.getTime() - clockIn.getTime()) / 60000);
    const totalHours = totalMinutes / 60;

    await (this.prisma as any).attendanceRecord.update({
      where: { id: record.id },
      data: { clockOutTime, clockOutLocation: data?.location, clockOutIp: data?.ip, totalHours },
    });

    await this.logClockEvent(employeeId, record.id, 'clock_out', clockOutTime, data);
    await this.calculateOvertimeHours(record.id);

    return { success: true, clock_out_time: clockOutTime, total_hours: totalHours };
  }

  async getAttendanceStatus(employeeId: string) {
    const today = new Date().toISOString().split('T')[0];

    const record = await (this.prisma as any).attendanceRecord.findFirst({
      where: { employeeId, attendanceDate: new Date(today) },
      include: { shift: true },
    });

    if (!record) return { is_clocked_in: false, attendance_date: today };

    return {
      is_clocked_in: !!record.clockInTime && !record.clockOutTime,
      clock_in_time: record.clockInTime,
      clock_out_time: record.clockOutTime,
      total_hours: record.totalHours,
      minutes_late: record.minutesLate,
      status: record.status,
      shift: record.shift ? { name: record.shift.shiftName, start_time: record.shift.startTime, end_time: record.shift.endTime } : null,
    };
  }

  async getShifts(filters?: { is_active?: boolean; country?: string }) {
    return (this.prisma as any).shift.findMany({
      where: {
        ...(filters?.is_active !== undefined && { isActive: filters.is_active }),
        ...(filters?.country && { country: filters.country }),
      },
      orderBy: { shiftName: 'asc' },
    });
  }

  async createShift(data: any) {
    return (this.prisma as any).shift.create({
      data: {
        shiftName: data.shift_name,
        shiftCode: data.shift_code,
        startTime: data.start_time,
        endTime: data.end_time,
        breakDurationMinutes: data.break_duration_minutes || 0,
        breakPaid: data.break_paid || false,
        shiftType: data.shift_type || 'regular',
        overtimeMultiplier: data.overtime_multiplier || 1.0,
        lateGracePeriod: data.late_grace_period || 0,
        isActive: true,
        country: data.country,
        legalEntityId: data.legal_entity_id,
      },
    });
  }

  async assignShift(employeeId: string, shiftId: string, data: any) {
    const assignment = await (this.prisma as any).shiftAssignment.create({
      data: {
        employeeId,
        shiftId,
        effectiveFrom: new Date(data.effective_from),
        effectiveTo: data.effective_to ? new Date(data.effective_to) : null,
        workDays: data.work_days || [1, 2, 3, 4, 5],
        status: 'active',
        createdBy: data.created_by,
      },
    });
    return { success: true, assignment_id: assignment.id };
  }

  private async getEmployeeShift(employeeId: string) {
    const today = new Date();
    const dayOfWeek = today.getDay();

    const assignment = await (this.prisma as any).shiftAssignment.findFirst({
      where: {
        employeeId,
        status: 'active',
        effectiveFrom: { lte: today },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
      },
      include: { shift: true },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!assignment) return null;
    const workDays = assignment.workDays || [1, 2, 3, 4, 5];
    if (!workDays.includes(dayOfWeek)) return null;

    return assignment.shift;
  }

  async getAttendanceRecords(employeeId: string, filters?: { date_from?: string; date_to?: string }) {
    return (this.prisma as any).attendanceRecord.findMany({
      where: {
        employeeId,
        ...(filters?.date_from && { attendanceDate: { gte: new Date(filters.date_from) } }),
        ...(filters?.date_to && { attendanceDate: { lte: new Date(filters.date_to) } }),
      },
      include: { shift: { select: { shiftName: true } } },
      orderBy: { attendanceDate: 'desc' },
    });
  }

  async getAttendanceSummary(employeeId: string, month: string) {
    const summary = await (this.prisma as any).attendanceSummary.findFirst({
      where: { employeeId, summaryMonth: new Date(`${month}-01`) },
    });

    if (summary) return summary;
    return this.calculateAttendanceSummary(employeeId, month);
  }

  private async calculateAttendanceSummary(employeeId: string, month: string) {
    const monthStart = new Date(`${month}-01`);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    const records = await (this.prisma as any).attendanceRecord.findMany({
      where: { employeeId, attendanceDate: { gte: monthStart, lte: monthEnd } },
    });

    return {
      employee_id: employeeId,
      summary_month: monthStart,
      total_days: records.length,
      days_present: records.filter((r: any) => r.status === 'present').length,
      days_absent: records.filter((r: any) => r.status === 'absent').length,
      days_late: records.filter((r: any) => r.minutesLate > 0).length,
      total_hours_worked: records.reduce((sum: number, r: any) => sum + (r.totalHours || 0), 0),
      overtime_hours: records.reduce((sum: number, r: any) => sum + (r.overtimeHours || 0), 0),
    };
  }

  async requestOvertime(data: any) {
    const request = await (this.prisma as any).overtimeRequest.create({
      data: {
        employeeId: data.employee_id,
        requestedBy: data.requested_by,
        overtimeDate: new Date(data.overtime_date),
        startTime: data.start_time,
        endTime: data.end_time,
        estimatedHours: data.estimated_hours,
        reason: data.reason,
        overtimeMultiplier: data.overtime_multiplier || 1.5,
        status: 'pending',
      },
    });
    return { success: true, request_id: request.id };
  }

  async approveOvertime(requestId: string, approvedBy: string) {
    await (this.prisma as any).overtimeRequest.update({
      where: { id: requestId },
      data: { status: 'approved', approvedBy, approvedAt: new Date() },
    });
  }

  private async calculateLateness(recordId: string, clockInTime: Date, shift: any) {
    if (!shift.startTime) return;
    const expectedStart = new Date(clockInTime.toDateString() + ' ' + shift.startTime);
    const minutesLate = Math.max(0, Math.floor((clockInTime.getTime() - expectedStart.getTime()) / 60000));

    if (minutesLate > (shift.lateGracePeriod || 0)) {
      await (this.prisma as any).attendanceRecord.update({
        where: { id: recordId },
        data: { minutesLate, status: 'late' },
      });
    }
  }

  private async calculateOvertimeHours(recordId: string) {
    const record = await (this.prisma as any).attendanceRecord.findUnique({
      where: { id: recordId },
      include: { shift: true },
    });

    if (!record) return;
    const totalHours = record.totalHours || 0;
    const shiftHours = record.shift?.totalHours || 8;

    if (totalHours > shiftHours) {
      await (this.prisma as any).attendanceRecord.update({
        where: { id: recordId },
        data: { regularHours: shiftHours, overtimeHours: totalHours - shiftHours },
      });
    } else {
      await (this.prisma as any).attendanceRecord.update({
        where: { id: recordId },
        data: { regularHours: totalHours, overtimeHours: 0 },
      });
    }
  }

  private async logClockEvent(employeeId: string, attendanceRecordId: string, eventType: string, eventTime: Date, data?: any) {
    await (this.prisma as any).clockEvent.create({
      data: {
        employeeId,
        attendanceRecordId,
        eventType,
        eventTime,
        deviceType: data?.device_type || 'web',
        ipAddress: data?.ip,
        location: data?.location,
      },
    });
  }
}
