import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class PayrollReconciliationService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create period-over-period reconciliation
   */
  async createPeriodReconciliation(
    periodId: string,
    comparisonPeriodId: string,
    userId: string,
  ): Promise<string> {
    // Get payrun data for both periods
    const currentData = await this.getPeriodData(periodId);
    const comparisonData = await this.getPeriodData(comparisonPeriodId);

    if (!currentData || !comparisonData) {
      throw new Error('Period data not found');
    }

    // Calculate variances for key metrics
    const items = [
      { type: 'gross_pay', current: currentData.gross_pay, comparison: comparisonData.gross_pay },
      { type: 'deductions', current: currentData.deductions, comparison: comparisonData.deductions },
      { type: 'net_pay', current: currentData.net_pay, comparison: comparisonData.net_pay },
      { type: 'paye', current: currentData.paye, comparison: comparisonData.paye },
      { type: 'uif', current: currentData.uif, comparison: comparisonData.uif },
      { type: 'employee_count', current: currentData.employee_count, comparison: comparisonData.employee_count },
    ];

    let totalVariance = 0;
    const itemsData = items.map(item => {
      const varianceAmount = item.current - item.comparison;
      const variancePercentage = item.comparison !== 0
        ? (varianceAmount / item.comparison) * 100
        : 0;

      if (item.type !== 'employee_count') {
        totalVariance += Math.abs(varianceAmount);
      }

      return {
        itemType: item.type,
        currentValue: item.current,
        comparisonValue: item.comparison,
        varianceAmount,
        variancePercentage,
      };
    });

    const totalVariancePercentage = comparisonData.gross_pay !== 0
      ? (totalVariance / comparisonData.gross_pay) * 100
      : 0;

    // Create reconciliation with items in a transaction
    const reconciliation = await this.prisma.payrollReconciliation.create({
      data: {
        periodId,
        comparisonPeriodId,
        reconciliationType: 'period_over_period',
        totalVariance,
        variancePercentage: totalVariancePercentage,
        status: 'completed',
        reconciledBy: userId,
        reconciledAt: new Date(),
        items: {
          create: itemsData,
        },
      },
    });

    return reconciliation.id;
  }

  /**
   * Get period data for reconciliation
   */
  private async getPeriodData(periodId: string): Promise<any> {
    const period = await this.prisma.payPeriod.findUnique({
      where: { id: periodId },
      include: {
        payRuns: {
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!period || period.payRuns.length === 0) {
      return null;
    }

    const payrunId = period.payRuns[0].id;

    // Aggregate payroll data from employee results
    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
    });

    const totals = results.reduce(
      (acc, result) => ({
        gross_pay: acc.gross_pay + Number(result.gross),
        deductions: acc.deductions + Number(result.deductionsTotal),
        net_pay: acc.net_pay + Number(result.net),
        paye: acc.paye + Number(result.paye),
        uif: 0, // UIF would need to be calculated from payLines
        employee_count: acc.employee_count + 1,
      }),
      { gross_pay: 0, deductions: 0, net_pay: 0, paye: 0, uif: 0, employee_count: 0 },
    );

    return totals;
  }

  /**
   * Get reconciliation details
   */
  async getReconciliationDetails(reconciliationId: string): Promise<any> {
    const reconciliation = await this.prisma.payrollReconciliation.findUnique({
      where: { id: reconciliationId },
      include: {
        period: true,
        comparisonPeriod: true,
        reconciledByUser: {
          select: { firstName: true, lastName: true },
        },
        items: {
          orderBy: { itemType: 'asc' },
        },
      },
    });

    if (!reconciliation) {
      throw new Error('Reconciliation not found');
    }

    return {
      ...reconciliation,
      current_period_name: `${reconciliation.period.year}-${reconciliation.period.periodNum}`,
      comparison_period_name: `${reconciliation.comparisonPeriod.year}-${reconciliation.comparisonPeriod.periodNum}`,
      reconciled_by_name: reconciliation.reconciledByUser
        ? `${reconciliation.reconciledByUser.firstName} ${reconciliation.reconciledByUser.lastName}`
        : null,
    };
  }

  /**
   * Explain variance
   */
  async explainVariance(itemId: string, explanation: string): Promise<void> {
    await this.prisma.payrollReconciliationItem.update({
      where: { id: itemId },
      data: {
        explanation,
        isExplained: true,
      },
    });
  }

  /**
   * Get reconciliations for a period
   */
  async getReconciliationsForPeriod(periodId: string): Promise<any[]> {
    const reconciliations = await this.prisma.payrollReconciliation.findMany({
      where: { periodId },
      include: {
        comparisonPeriod: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reconciliations.map(r => ({
      ...r,
      comparison_period_name: `${r.comparisonPeriod.year}-${r.comparisonPeriod.periodNum}`,
    }));
  }
}
