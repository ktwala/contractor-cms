import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

@Injectable()
export class PayrollExceptionsService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Detect and create payroll exceptions for a period
   */
  async detectExceptions(periodId: string, payrunId: string): Promise<number> {
    let exceptionsCount = 0;

    // Get employee results for this payrun
    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
      include: {
        employee: true,
      },
    });

    for (const result of results) {
      const netPay = Number(result.net);
      const grossPay = Number(result.gross);

      // Check for negative pay
      if (netPay < 0) {
        await this.createException(
          periodId,
          payrunId,
          result.employeeId,
          'negative_pay',
          'earnings',
          'critical',
          `Negative net pay detected: ${netPay}`,
          0,
          netPay,
        );
        exceptionsCount++;
      }

      // Check for zero pay
      if (netPay === 0 && grossPay > 0) {
        await this.createException(
          periodId,
          payrunId,
          result.employeeId,
          'zero_pay',
          'earnings',
          'medium',
          'Zero net pay with positive gross pay',
          grossPay,
          0,
        );
        exceptionsCount++;
      }

      // Check for significant variance from previous period
      const previousPay = await this.getPreviousPeriodPay(result.employeeId, payrunId);
      if (previousPay) {
        const variance = grossPay - previousPay;
        const variancePercentage = (variance / previousPay) * 100;

        if (Math.abs(variancePercentage) > 20) {
          await this.createException(
            periodId,
            payrunId,
            result.employeeId,
            'variance_threshold',
            'earnings',
            'medium',
            `Significant variance from previous period: ${variancePercentage.toFixed(2)}%`,
            previousPay,
            grossPay,
          );
          exceptionsCount++;
        }
      }
    }

    return exceptionsCount;
  }

  /**
   * Create an exception
   */
  private async createException(
    periodId: string,
    payrunId: string,
    employeeId: string,
    exceptionType: string,
    exceptionCategory: string,
    severity: string,
    description: string,
    expectedValue: number | null,
    actualValue: number | null,
  ): Promise<string> {
    const exception = await this.prisma.payrollException.create({
      data: {
        periodId,
        payrunId,
        employeeId,
        exceptionType,
        exceptionCategory,
        severity,
        description,
        expectedValue: expectedValue !== null ? expectedValue : undefined,
        actualValue: actualValue !== null ? actualValue : undefined,
        status: 'pending',
      },
    });

    return exception.id;
  }

  /**
   * Get previous period pay for an employee
   */
  private async getPreviousPeriodPay(employeeId: string, currentPayrunId: string): Promise<number | null> {
    const previousResult = await this.prisma.employeeResult.findFirst({
      where: {
        employeeId,
        payrunId: { not: currentPayrunId },
      },
      orderBy: { createdAt: 'desc' },
    });

    return previousResult ? Number(previousResult.gross) : null;
  }

  /**
   * Get exceptions for a period
   */
  async getExceptionsForPeriod(periodId: string, status?: string, severity?: string): Promise<any[]> {
    const where: any = { periodId };

    if (status) {
      where.status = status;
    }

    if (severity) {
      where.severity = severity;
    }

    const exceptions = await this.prisma.payrollException.findMany({
      where,
      include: {
        employee: {
          select: { firstName: true, lastName: true, employeeNo: true },
        },
      },
      orderBy: [{ severity: 'desc' }, { createdAt: 'asc' }],
    });

    return exceptions.map(e => ({
      ...e,
      employee_name: `${e.employee.firstName} ${e.employee.lastName}`,
      employee_number: e.employee.employeeNo,
    }));
  }

  /**
   * Resolve an exception
   */
  async resolveException(exceptionId: string, userId: string, resolutionNotes: string): Promise<void> {
    await this.prisma.payrollException.update({
      where: { id: exceptionId },
      data: {
        status: 'resolved',
        resolvedBy: userId,
        resolvedAt: new Date(),
        resolutionNotes,
      },
    });
  }

  /**
   * Dismiss an exception
   */
  async dismissException(exceptionId: string, userId: string, reason: string): Promise<void> {
    await this.prisma.payrollException.update({
      where: { id: exceptionId },
      data: {
        status: 'dismissed',
        dismissedBy: userId,
        dismissedAt: new Date(),
        dismissReason: reason,
      },
    });
  }

  /**
   * Get exception statistics
   */
  async getExceptionStats(periodId: string): Promise<any> {
    const exceptions = await this.prisma.payrollException.findMany({
      where: { periodId },
    });

    const stats = {
      total: exceptions.length,
      critical: exceptions.filter(e => e.severity === 'critical').length,
      high: exceptions.filter(e => e.severity === 'high').length,
      medium: exceptions.filter(e => e.severity === 'medium').length,
      low: exceptions.filter(e => e.severity === 'low').length,
      pending: exceptions.filter(e => e.status === 'pending').length,
      resolved: exceptions.filter(e => e.status === 'resolved').length,
      dismissed: exceptions.filter(e => e.status === 'dismissed').length,
    };

    return stats;
  }
}
