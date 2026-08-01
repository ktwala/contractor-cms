import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

export interface COIDAAssessmentSummary {
  id: string;
  assessmentYear: number;
  riskClass: string;
  tariffRate: number;
  totalRemuneration: number;
  totalAssessment: number;
  balanceDue: number;
  status: string;
}

@Injectable()
export class CoidaService {
  private readonly logger = new Logger(CoidaService.name);

  constructor(private readonly prisma: PrismaService) { }

  // Generate COIDA assessment for a year
  async generateAssessment(
    legalEntityId: string,
    assessmentYear: number,
    riskClass: string,
    tariffRate: number,
    userId: string,
  ): Promise<string> {
    // Get all payroll data for the year
    const startDate = new Date(`${assessmentYear}-01-01`);
    const endDate = new Date(`${assessmentYear}-12-31`);

    const payGroups = await this.prisma.payGroup.findMany({
      where: { legalEntityId },
      include: {
        payRuns: {
          where: {
            periodStart: { gte: startDate },
            periodEnd: { lte: endDate },
          },
          include: {
            employeeResults: true,
          },
        },
      },
    });

    // Calculate assessment for each employee
    const employeeData: Record<string, number> = {};

    for (const payGroup of payGroups) {
      for (const payRun of payGroup.payRuns) {
        for (const result of payRun.employeeResults) {
          if (!employeeData[result.employeeId]) {
            employeeData[result.employeeId] = 0;
          }
          employeeData[result.employeeId] += Number(result.gross);
        }
      }
    }

    const lines = Object.entries(employeeData).map(([employeeId, remuneration]) => ({
      employeeId,
      remuneration,
      assessment: Math.round(remuneration * tariffRate * 100) / 100,
    }));

    const totalRemuneration = lines.reduce((sum, l) => sum + l.remuneration, 0);
    const totalAssessment = lines.reduce((sum, l) => sum + l.assessment, 0);

    const assessment = await this.prisma.cOIDAAssessment.create({
      data: {
        legalEntityId,
        assessmentYear,
        riskClass,
        tariffRate,
        totalEmployees: lines.length,
        totalRemuneration,
        totalAssessment,
        balanceDue: totalAssessment,
        status: 'draft',
        createdBy: userId,
        lines: {
          create: lines,
        },
      },
    });

    this.logger.log(`Generated COIDA assessment ${assessment.id} for year ${assessmentYear}`);
    return assessment.id;
  }

  // Get COIDA assessment
  async getAssessment(assessmentId: string): Promise<any> {
    return this.prisma.cOIDAAssessment.findUnique({
      where: { id: assessmentId },
      include: {
        legalEntity: true,
        lines: true,
      },
    });
  }

  // Get COIDA assessments for legal entity
  async getAssessments(
    legalEntityId: string,
    filters?: { year?: number; status?: string; limit?: number },
  ): Promise<any[]> {
    const where: any = { legalEntityId };

    if (filters?.year) {
      where.assessmentYear = filters.year;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.cOIDAAssessment.findMany({
      where,
      orderBy: { assessmentYear: 'desc' },
      take: filters?.limit || 10,
    });
  }

  // Submit COIDA assessment
  async submitAssessment(assessmentId: string, userId: string): Promise<void> {
    await this.prisma.cOIDAAssessment.update({
      where: { id: assessmentId },
      data: {
        status: 'submitted',
        submittedBy: userId,
        submittedAt: new Date(),
      },
    });

    this.logger.log(`COIDA assessment ${assessmentId} submitted`);
  }

  // Record payment
  async recordPayment(
    assessmentId: string,
    paidAmount: number,
    userId: string,
  ): Promise<void> {
    const assessment = await this.prisma.cOIDAAssessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const newPaidAmount = Number(assessment.paidAmount) + paidAmount;
    const newBalance = Number(assessment.totalAssessment) - newPaidAmount;
    const status = newBalance <= 0 ? 'paid' : 'partially_paid';

    await this.prisma.cOIDAAssessment.update({
      where: { id: assessmentId },
      data: {
        paidAmount: newPaidAmount,
        balanceDue: Math.max(0, newBalance),
        status,
        paidAt: new Date(),
      },
    });

    this.logger.log(`COIDA payment of ${paidAmount} recorded for assessment ${assessmentId}`);
  }

  // Export return of earnings to CSV
  async exportToCSV(assessmentId: string): Promise<string> {
    const assessment = await this.prisma.cOIDAAssessment.findUnique({
      where: { id: assessmentId },
      include: { lines: true },
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    const headers = ['Employee ID', 'Annual Remuneration', 'Assessment'];
    const rows = assessment.lines.map(line => [
      line.employeeId,
      line.remuneration.toString(),
      line.assessment.toString(),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Get COIDA summary for year range
  async getCoidaSummary(legalEntityId: string, startYear: number, endYear: number): Promise<any> {
    const assessments = await this.prisma.cOIDAAssessment.findMany({
      where: {
        legalEntityId,
        assessmentYear: { gte: startYear, lte: endYear },
      },
      orderBy: { assessmentYear: 'asc' },
    });

    return {
      yearCount: assessments.length,
      totalRemuneration: assessments.reduce((sum, a) => sum + Number(a.totalRemuneration), 0),
      totalAssessment: assessments.reduce((sum, a) => sum + Number(a.totalAssessment), 0),
      totalPaid: assessments.reduce((sum, a) => sum + Number(a.paidAmount), 0),
      totalOutstanding: assessments.reduce((sum, a) => sum + Number(a.balanceDue), 0),
      assessments: assessments.map(a => ({
        year: a.assessmentYear,
        riskClass: a.riskClass,
        assessment: Number(a.totalAssessment),
        paid: Number(a.paidAmount),
        balance: Number(a.balanceDue),
        status: a.status,
      })),
    };
  }

  // Delete COIDA assessment (only if draft)
  async deleteAssessment(assessmentId: string, userId: string): Promise<void> {
    const assessment = await this.prisma.cOIDAAssessment.findUnique({
      where: { id: assessmentId },
    });

    if (!assessment) {
      throw new Error('Assessment not found');
    }

    if (assessment.status !== 'draft') {
      throw new Error('Can only delete draft assessments');
    }

    await this.prisma.cOIDAAssessment.delete({
      where: { id: assessmentId },
    });

    this.logger.log(`COIDA assessment ${assessmentId} deleted by ${userId}`);
  }
}
