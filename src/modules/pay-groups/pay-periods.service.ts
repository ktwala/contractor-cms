import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  addMonths,
  addWeeks,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  setDate,
  format,
  subDays,
} from 'date-fns';
import { PayFrequency } from '../../common/dto/enums.dto';

@Injectable()
export class PayPeriodsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async generateForYear(payGroupId: string, year: number, userId?: string, reason?: string) {
    const payGroup = await this.prisma.payGroup.findUnique({
      where: { id: payGroupId },
    });

    if (!payGroup) {
      throw new NotFoundException({
        code: 'PAY_GROUP_NOT_FOUND',
        message: `Pay group with id '${payGroupId}' not found`,
      });
    }

    // Check if periods already exist for this year
    const existingPeriods = await this.prisma.payPeriod.findMany({
      where: {
        payGroupId,
        year,
      },
    });

    if (existingPeriods.length > 0) {
      throw new ConflictException({
        code: 'PERIODS_EXIST',
        message: `Pay periods for year ${year} already exist for this pay group`,
      });
    }

    const periods = this.calculatePeriods(payGroup, year);

    const createdPeriods = await this.prisma.$transaction(
      periods.map((period) =>
        this.prisma.payPeriod.create({
          data: period,
        }),
      ),
    );

    await this.auditService.log({
      userId,
      action: 'GENERATE_PERIODS',
      entityType: 'PayGroup',
      entityId: payGroupId,
      newValue: { year, periods_count: createdPeriods.length },
      reason,
    });

    return {
      pay_group_id: payGroupId,
      year,
      created_count: createdPeriods.length,
    };
  }

  async listPeriods(payGroupId: string, year?: number) {
    const payGroup = await this.prisma.payGroup.findUnique({
      where: { id: payGroupId },
    });

    if (!payGroup) {
      throw new NotFoundException({
        code: 'PAY_GROUP_NOT_FOUND',
        message: `Pay group with id '${payGroupId}' not found`,
      });
    }

    const where: any = { payGroupId };
    if (year) {
      where.year = year;
    }

    const periods = await this.prisma.payPeriod.findMany({
      where,
      orderBy: [{ year: 'asc' }, { periodNum: 'asc' }],
    });

    return {
      items: periods.map(this.mapToResponse),
    };
  }

  private calculatePeriods(payGroup: any, year: number) {
    const periods: any[] = [];
    const calendar = payGroup.defaultCalendar || {};
    const cutoffDay = calendar.cutoff_day || 25;
    const payDay = calendar.pay_day || 25;

    switch (payGroup.frequency) {
      case PayFrequency.MONTHLY:
        for (let month = 0; month < 12; month++) {
          const periodStart = startOfMonth(new Date(year, month));
          const periodEnd = endOfMonth(new Date(year, month));
          const payDate = this.calculatePayDate(year, month, payDay, calendar);
          const cutoffDate = this.calculateCutoffDate(year, month, cutoffDay);

          periods.push({
            payGroupId: payGroup.id,
            startDate: periodStart,
            endDate: periodEnd,
            payDate,
            cutoffDate,
            year,
            periodNum: month + 1,
          });
        }
        break;

      case PayFrequency.BIWEEKLY:
        let biweeklyStart = startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 });
        let periodNum = 1;

        while (biweeklyStart.getFullYear() <= year) {
          const periodEnd = addWeeks(biweeklyStart, 2);
          periodEnd.setDate(periodEnd.getDate() - 1);

          if (biweeklyStart.getFullYear() === year || periodEnd.getFullYear() === year) {
            const payDate = addWeeks(biweeklyStart, 2);

            periods.push({
              payGroupId: payGroup.id,
              startDate: biweeklyStart,
              endDate: periodEnd,
              payDate,
              cutoffDate: periodEnd,
              year,
              periodNum,
            });
            periodNum++;
          }

          biweeklyStart = addWeeks(biweeklyStart, 2);
          if (periodNum > 27) break; // Safety limit
        }
        break;

      case PayFrequency.WEEKLY:
        let weeklyStart = startOfWeek(new Date(year, 0, 1), { weekStartsOn: 1 });
        let weekNum = 1;

        while (weeklyStart.getFullYear() <= year) {
          const periodEnd = endOfWeek(weeklyStart, { weekStartsOn: 1 });

          if (weeklyStart.getFullYear() === year || periodEnd.getFullYear() === year) {
            const payDate = addWeeks(weeklyStart, 1);

            periods.push({
              payGroupId: payGroup.id,
              startDate: weeklyStart,
              endDate: periodEnd,
              payDate,
              cutoffDate: periodEnd,
              year,
              periodNum: weekNum,
            });
            weekNum++;
          }

          weeklyStart = addWeeks(weeklyStart, 1);
          if (weekNum > 53) break; // Safety limit
        }
        break;
    }

    return periods;
  }

  /**
   * Calculate pay date for a month.
   * - pay_day_rule 'last_working_day': Use last day of month; if Sat/Sun, use last Friday.
   * - pay_day_rule 'fixed' (default): Use pay_day; if Sat/Sun, use previous Friday.
   */
  private calculatePayDate(year: number, month: number, day: number, calendar?: any): Date {
    const payDayRule = calendar?.pay_day_rule || 'fixed';

    if (payDayRule === 'last_working_day') {
      // Last day of month
      const lastDay = endOfMonth(new Date(year, month));
      const dayOfWeek = lastDay.getDay();
      if (dayOfWeek === 0) return subDays(lastDay, 2); // Sunday -> Friday
      if (dayOfWeek === 6) return subDays(lastDay, 1); // Saturday -> Friday
      return lastDay;
    }

    // Fixed day: use pay_day, adjust for weekend
    const date = new Date(year, month, Math.min(day, 28));
    const dayOfWeek = date.getDay();
    if (dayOfWeek === 0) date.setDate(date.getDate() - 2); // Sunday -> Friday
    if (dayOfWeek === 6) date.setDate(date.getDate() - 1); // Saturday -> Friday
    return date;
  }

  private calculateCutoffDate(year: number, month: number, day: number): Date {
    return new Date(year, month, Math.min(day, 28));
  }

  private mapToResponse(period: any) {
    return {
      id: period.id,
      pay_group_id: period.payGroupId,
      start_date: format(period.startDate, 'yyyy-MM-dd'),
      end_date: format(period.endDate, 'yyyy-MM-dd'),
      pay_date: format(period.payDate, 'yyyy-MM-dd'),
      cutoff_date: period.cutoffDate ? format(period.cutoffDate, 'yyyy-MM-dd') : null,
    };
  }
}
