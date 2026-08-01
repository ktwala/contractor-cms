import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { PayFrequency } from '@prisma/client';

export interface PayrollCalendar {
  id: string;
  name: string;
  code?: string;
  frequency: string;
  country?: string;
  currency?: string;
  legalEntityId: string;
  legalEntity?: { name: string };
}

export interface PayrollPeriod {
  id: string;
  payGroupId: string;
  startDate: Date;
  endDate: Date;
  payDate: Date;
  cutoffDate: Date | null;
  year: number;
  periodNum: number;
}

@Injectable()
export class PayrollCalendarService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Get pay groups (calendars) for a legal entity
   * Note: In the actual schema, PayGroups serve as the calendar configuration
   */
  async getCalendars(legalEntityId?: string): Promise<PayrollCalendar[]> {
    const where: any = {};
    if (legalEntityId) where.legalEntityId = legalEntityId;

    const payGroups = await this.prisma.payGroup.findMany({
      where,
      include: { legalEntity: { select: { name: true } } },
      orderBy: { name: 'asc' },
    });

    return payGroups.map(pg => ({
      id: pg.id,
      name: pg.name,
      code: (pg as any).code,
      frequency: pg.frequency,
      country: (pg as any).country,
      currency: (pg as any).currency,
      legalEntityId: pg.legalEntityId,
      legalEntity: (pg as any).legalEntity,
    }));
  }

  /**
   * Generate payroll periods for a pay group
   */
  async generatePeriods(
    payGroupId: string,
    numberOfPeriods: number,
    startYear?: number,
  ): Promise<string[]> {
    const payGroup = await this.prisma.payGroup.findUnique({
      where: { id: payGroupId },
    });

    if (!payGroup) {
      throw new Error('Pay group not found');
    }

    const year = startYear || new Date().getFullYear();
    const periodIds: string[] = [];

    for (let i = 0; i < numberOfPeriods; i++) {
      const periodData = this.calculatePeriod(payGroup.frequency, year, i + 1);

      // Check if period already exists
      const existing = await this.prisma.payPeriod.findUnique({
        where: {
          payGroupId_year_periodNum: {
            payGroupId,
            year: periodData.year,
            periodNum: periodData.periodNum,
          },
        },
      });

      if (existing) {
        periodIds.push(existing.id);
        continue;
      }

      const period = await this.prisma.payPeriod.create({
        data: {
          payGroupId,
          year: periodData.year,
          periodNum: periodData.periodNum,
          startDate: periodData.startDate,
          endDate: periodData.endDate,
          payDate: periodData.payDate,
          cutoffDate: periodData.cutoffDate,
        },
      });

      periodIds.push(period.id);
    }

    return periodIds;
  }

  /**
   * Calculate period dates based on frequency
   */
  private calculatePeriod(frequency: PayFrequency, year: number, periodNum: number): {
    year: number;
    periodNum: number;
    startDate: Date;
    endDate: Date;
    payDate: Date;
    cutoffDate: Date;
  } {
    let startDate: Date;
    let endDate: Date;

    switch (frequency) {
      case 'WEEKLY':
        // Periods 1-52
        startDate = this.getWeekStart(year, periodNum);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 6);
        break;

      case 'BIWEEKLY':
        // Periods 1-26
        startDate = this.getWeekStart(year, (periodNum - 1) * 2 + 1);
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 13);
        break;

      case 'MONTHLY':
      default:
        // Periods 1-12
        const monthIndex = (periodNum - 1) % 12;
        const periodYear = year + Math.floor((periodNum - 1) / 12);
        startDate = new Date(periodYear, monthIndex, 1);
        endDate = new Date(periodYear, monthIndex + 1, 0); // Last day of month
        break;
    }

    // Payment date (typically 2 days after period end)
    const payDate = new Date(endDate);
    payDate.setDate(endDate.getDate() + 2);

    // Cutoff date (typically 2 days before period end)
    const cutoffDate = new Date(endDate);
    cutoffDate.setDate(endDate.getDate() - 2);

    return {
      year,
      periodNum,
      startDate,
      endDate,
      payDate,
      cutoffDate,
    };
  }

  /**
   * Get the start of a week
   */
  private getWeekStart(year: number, weekNum: number): Date {
    const jan1 = new Date(year, 0, 1);
    const daysOffset = (weekNum - 1) * 7 - jan1.getDay() + 1;
    return new Date(year, 0, 1 + daysOffset);
  }

  /**
   * Get current active period for a legal entity
   */
  async getCurrentPeriod(legalEntityId: string): Promise<any | null> {
    const today = new Date();

    const period = await this.prisma.payPeriod.findFirst({
      where: {
        payGroup: { legalEntityId },
        startDate: { lte: today },
        endDate: { gte: today },
      },
      include: {
        payGroup: true,
      },
      orderBy: { startDate: 'desc' },
    });

    return period;
  }

  /**
   * Get upcoming periods for a legal entity
   */
  async getUpcomingPeriods(legalEntityId: string, limit: number = 12): Promise<any[]> {
    const today = new Date();

    return this.prisma.payPeriod.findMany({
      where: {
        payGroup: { legalEntityId },
        startDate: { gte: today },
      },
      include: {
        payGroup: true,
      },
      orderBy: { startDate: 'asc' },
      take: limit,
    });
  }

  /**
   * Get period by ID
   */
  async getPeriodById(periodId: string): Promise<any> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: {
        payGroup: {
          include: {
            legalEntity: true,
          },
        },
        payRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    return {
      ...period,
      period_name: `${period.year}-${String(period.periodNum).padStart(2, '0')}`,
      calendar_name: period.payGroup.name,
      frequency: period.payGroup.frequency,
      has_payrun: period.payRuns.length > 0,
    };
  }

  /**
   * Get all periods for a pay group
   */
  async getPeriodsForPayGroup(payGroupId: string, year?: number): Promise<any[]> {
    const where: any = { payGroupId };
    if (year) {
      where.year = year;
    }

    return this.prisma.payPeriod.findMany({
      where,
      include: {
        payRuns: {
          select: { id: true, status: true },
        },
      },
      orderBy: [{ year: 'desc' }, { periodNum: 'desc' }],
    });
  }

  /**
   * Link payrun to period (update the payrun with period reference)
   */
  async linkPayrunToPeriod(periodId: string, payrunId: string): Promise<void> {
    await this.prisma.payRun.update({
      where: { id: payrunId },
      data: { periodId },
    });
  }

  /**
   * Get periods with payruns for reconciliation
   */
  async getPeriodsForReconciliation(legalEntityId: string, limit: number = 24): Promise<any[]> {
    return this.prisma.payPeriod.findMany({
      where: {
        payGroup: { legalEntityId },
        payRuns: {
          some: {},
        },
      },
      include: {
        payGroup: true,
        payRuns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            status: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ year: 'desc' }, { periodNum: 'desc' }],
      take: limit,
    });
  }

  /**
   * Create a payroll calendar (pay group)
   * Note: The controller expects this method for backwards compatibility
   */
  async createCalendar(
    calendarName: string,
    legalEntityId: string,
    frequency: 'weekly' | 'bi_weekly' | 'semi_monthly' | 'monthly' | 'quarterly' | 'annual',
    startDate: string,
    endDate: string | null,
    calendarConfig: any,
    userId: string,
  ): Promise<string> {
    // Map frequency to PayFrequency enum
    const frequencyMap: Record<string, PayFrequency> = {
      'weekly': 'WEEKLY',
      'bi_weekly': 'BIWEEKLY',
      'semi_monthly': 'MONTHLY', // Approximation
      'monthly': 'MONTHLY',
      'quarterly': 'MONTHLY', // No quarterly in enum
      'annual': 'MONTHLY', // No annual in enum
    };

    const code = `CAL_${Date.now()}`;

    const payGroup = await this.prisma.payGroup.create({
      data: {
        code,
        name: calendarName,
        country: 'ZA',
        currency: 'ZAR',
        frequency: frequencyMap[frequency] || 'MONTHLY',
        legalEntityId,
        defaultCalendar: calendarConfig,
      },
    });

    return payGroup.id;
  }

  /**
   * Lock a payroll period (by locking the payrun)
   */
  async lockPeriod(periodId: string, userId: string): Promise<void> {
    // Find the period's payrun and lock it
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: { payRuns: { take: 1 } },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    if (period.payRuns.length > 0) {
      const payrun = period.payRuns[0];
      if (payrun.lockedAt) {
        throw new Error('Period is already locked');
      }

      await this.prisma.payRun.update({
        where: { id: payrun.id },
        data: { lockedAt: new Date() },
      });
    }
  }

  /**
   * Unlock a payroll period (by unlocking the payrun)
   */
  async unlockPeriod(periodId: string, userId: string): Promise<void> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: { payRuns: { take: 1 } },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    if (period.payRuns.length > 0) {
      await this.prisma.payRun.update({
        where: { id: period.payRuns[0].id },
        data: { lockedAt: null },
      });
    }
  }

  /**
   * Update period status (via payrun status)
   */
  async updatePeriodStatus(
    periodId: string,
    status: 'upcoming' | 'open' | 'locked' | 'processing' | 'completed' | 'closed',
  ): Promise<void> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: { payRuns: { take: 1 } },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    // Map status to PayRunStatus
    if (period.payRuns.length > 0 && status === 'completed') {
      await this.prisma.payRun.update({
        where: { id: period.payRuns[0].id },
        data: { status: 'FINALIZED' },
      });
    }
  }

  /**
   * Close a payroll period
   */
  async closePeriod(periodId: string, userId: string): Promise<void> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: { payRuns: { take: 1 } },
    });

    if (!period) {
      throw new Error('Period not found');
    }

    if (period.payRuns.length > 0) {
      await this.prisma.payRun.update({
        where: { id: period.payRuns[0].id },
        data: { status: 'PAID' },
      });
    }

    await this.prisma.payPeriod.update({
      where: { id: periodId },
      data: {
        closedAt: new Date(),
        closedByUserId: userId || null,
      },
    });
  }
}

