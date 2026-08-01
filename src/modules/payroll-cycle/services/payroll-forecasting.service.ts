import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class PayrollForecastingService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create a payroll forecast
   */
  async createForecast(
    legalEntityId: string,
    forecastName: string,
    forecastType: 'monthly' | 'quarterly' | 'annual',
    periodStart: string,
    periodEnd: string,
    forecastMethod: 'historical_average' | 'trend_analysis' | 'manual' | 'budget_based',
    basePeriodId: string | null,
    assumptions: any,
    userId: string,
  ): Promise<string> {
    const forecast = await this.prisma.payrollForecast.create({
      data: {
        legalEntityId,
        forecastName,
        forecastType,
        forecastPeriodStart: new Date(periodStart),
        forecastPeriodEnd: new Date(periodEnd),
        basePeriodId,
        forecastMethod,
        assumptions,
        createdBy: userId,
        status: 'draft',
      },
    });

    // Generate forecast items based on method
    if (forecastMethod === 'historical_average') {
      await this.generateHistoricalAverageForecast(forecast.id, legalEntityId);
    } else if (forecastMethod === 'trend_analysis') {
      await this.generateTrendForecast(forecast.id, legalEntityId);
    }

    // Calculate total forecast
    await this.calculateForecastTotal(forecast.id);

    return forecast.id;
  }

  /**
   * Generate forecast based on historical average
   */
  private async generateHistoricalAverageForecast(
    forecastId: string,
    legalEntityId: string,
  ): Promise<void> {
    // Get last 6 months of employee results for this legal entity
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const payRuns = await this.prisma.payRun.findMany({
      where: {
        payGroup: { legalEntityId },
        createdAt: { gte: sixMonthsAgo },
      },
      include: {
        employeeResults: true,
      },
    });

    if (payRuns.length === 0) {
      // No data, create default items
      await this.prisma.payrollForecastItem.createMany({
        data: [
          { forecastId, itemType: 'basic_salary', forecastAmount: 0 },
          { forecastId, itemType: 'overtime', forecastAmount: 0 },
          { forecastId, itemType: 'benefits', forecastAmount: 0 },
          { forecastId, itemType: 'deductions', forecastAmount: 0 },
        ],
      });
      return;
    }

    // Calculate averages
    let totalGross = 0;
    let totalDeductions = 0;
    let count = 0;

    for (const payRun of payRuns) {
      for (const result of payRun.employeeResults) {
        totalGross += Number(result.gross);
        totalDeductions += Number(result.deductionsTotal);
        count++;
      }
    }

    const avgGross = count > 0 ? totalGross / count : 0;
    const avgDeductions = count > 0 ? totalDeductions / count : 0;

    // Create forecast items
    await this.prisma.payrollForecastItem.createMany({
      data: [
        { forecastId, itemType: 'basic_salary', forecastAmount: avgGross },
        { forecastId, itemType: 'deductions', forecastAmount: avgDeductions },
      ],
    });
  }

  /**
   * Generate forecast based on trend analysis
   */
  private async generateTrendForecast(
    forecastId: string,
    legalEntityId: string,
  ): Promise<void> {
    // Get last 12 months of data
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const payRuns = await this.prisma.payRun.findMany({
      where: {
        payGroup: { legalEntityId },
        createdAt: { gte: twelveMonthsAgo },
      },
      include: {
        employeeResults: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (payRuns.length < 2) {
      // Not enough data, fall back to average
      await this.generateHistoricalAverageForecast(forecastId, legalEntityId);
      return;
    }

    // Calculate monthly totals
    const monthlyData: number[] = [];
    for (const payRun of payRuns) {
      const total = payRun.employeeResults.reduce((sum, r) => sum + Number(r.gross), 0);
      monthlyData.push(total);
    }

    // Simple linear regression
    const n = monthlyData.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;

    for (let i = 0; i < n; i++) {
      const x = i + 1;
      const y = monthlyData[i];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Forecast for next period
    const forecastAmount = slope * (n + 1) + intercept;

    await this.prisma.payrollForecastItem.create({
      data: {
        forecastId,
        itemType: 'total_compensation',
        forecastAmount: Math.max(0, forecastAmount),
      },
    });
  }

  /**
   * Calculate total forecast
   */
  private async calculateForecastTotal(forecastId: string): Promise<void> {
    const items = await this.prisma.payrollForecastItem.findMany({
      where: { forecastId },
    });

    const total = items.reduce((sum, item) => sum + Number(item.forecastAmount), 0);

    await this.prisma.payrollForecast.update({
      where: { id: forecastId },
      data: {
        totalForecastAmount: total,
        status: 'active',
      },
    });
  }

  /**
   * Update forecast with actual data
   */
  async updateForecastActuals(forecastId: string, periodId: string): Promise<void> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: {
        payRuns: {
          take: 1,
          orderBy: { createdAt: 'desc' },
          include: {
            employeeResults: true,
          },
        },
      },
    });

    if (!period || period.payRuns.length === 0) {
      return;
    }

    const payRun = period.payRuns[0];
    const actualGross = payRun.employeeResults.reduce((sum, r) => sum + Number(r.gross), 0);

    // Update all items with actual amount
    const items = await this.prisma.payrollForecastItem.findMany({
      where: { forecastId },
    });

    for (const item of items) {
      const variance = actualGross - Number(item.forecastAmount);
      const variancePercentage = Number(item.forecastAmount) !== 0
        ? (variance / Number(item.forecastAmount)) * 100
        : 0;

      await this.prisma.payrollForecastItem.update({
        where: { id: item.id },
        data: {
          actualAmount: actualGross,
          varianceAmount: variance,
          variancePercentage,
        },
      });
    }
  }

  /**
   * Get forecast details
   */
  async getForecastDetails(forecastId: string): Promise<any> {
    const forecast = await this.prisma.payrollForecast.findUnique({
      where: { id: forecastId },
      include: {
        legalEntity: true,
        items: {
          orderBy: { itemType: 'asc' },
        },
      },
    });

    if (!forecast) {
      throw new Error('Forecast not found');
    }

    return forecast;
  }

  /**
   * Get all forecasts for a legal entity
   */
  async getForecasts(legalEntityId: string): Promise<any[]> {
    return this.prisma.payrollForecast.findMany({
      where: { legalEntityId },
      orderBy: { forecastPeriodStart: 'desc' },
    });
  }
}
