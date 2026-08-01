import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

interface UIFCalculation {
  remuneration: number;
  uifRemuneration: number;
  employerContribution: number;
  employeeContribution: number;
  totalContribution: number;
}

export interface UIFDeclarationSummary {
  id: string;
  declarationPeriod: string;
  totalEmployees: number;
  totalRemuneration: number;
  totalUifContribution: number;
  employerContribution: number;
  employeeContribution: number;
  status: string;
}

@Injectable()

export class UifService {
  private readonly logger = new Logger(UifService.name);
  private readonly UIF_RATE = 0.01;
  private readonly UIF_THRESHOLD = 17712.0;
  private readonly UIF_MAX_CONTRIBUTION = 177.12;

  constructor(private readonly prisma: PrismaService) { }

  // Calculate UIF for a given remuneration amount
  calculateUIF(remuneration: number): UIFCalculation {
    const uifRemuneration = Math.min(remuneration, this.UIF_THRESHOLD);
    const employeeContribution = Math.min(uifRemuneration * this.UIF_RATE, this.UIF_MAX_CONTRIBUTION);
    const employerContribution = employeeContribution;
    const totalContribution = employeeContribution + employerContribution;

    return {
      remuneration,
      uifRemuneration,
      employerContribution: Math.round(employerContribution * 100) / 100,
      employeeContribution: Math.round(employeeContribution * 100) / 100,
      totalContribution: Math.round(totalContribution * 100) / 100,
    };
  }

  // Generate UIF declaration for a period
  async generateDeclaration(
    legalEntityId: string,
    period: string, // YYYY-MM format
    userId: string,
  ): Promise<string> {
    // Get employees with payroll data for the period
    const payGroups = await this.prisma.payGroup.findMany({
      where: { legalEntityId },
      include: {
        payRuns: {
          where: {
            periodStart: { gte: new Date(`${period}-01`) },
            periodEnd: { lte: new Date(`${period}-31`) },
          },
          include: {
            employeeResults: {
              include: {
                employee: true,
              },
            },
          },
        },
      },
    });

    // Calculate UIF for each employee
    const lines: { employeeId: string; idNumber?: string; remuneration: number; uifRemuneration: number; employerContribution: number; employeeContribution: number; totalContribution: number }[] = [];

    let totalRemuneration = 0;
    let totalUifContribution = 0;
    let employerTotal = 0;
    let employeeTotal = 0;

    for (const payGroup of payGroups) {
      for (const payRun of payGroup.payRuns) {
        for (const result of payRun.employeeResults) {
          const remuneration = Number(result.gross);
          const uif = this.calculateUIF(remuneration);

          lines.push({
            employeeId: result.employeeId,
            idNumber: result.employee.nationalId || undefined,
            remuneration: uif.remuneration,
            uifRemuneration: uif.uifRemuneration,
            employerContribution: uif.employerContribution,
            employeeContribution: uif.employeeContribution,
            totalContribution: uif.totalContribution,
          });

          totalRemuneration += uif.remuneration;
          totalUifContribution += uif.totalContribution;
          employerTotal += uif.employerContribution;
          employeeTotal += uif.employeeContribution;
        }
      }
    }

    // Create declaration with lines
    const declaration = await this.prisma.uIFDeclaration.create({
      data: {
        legalEntityId,
        declarationPeriod: period,
        totalEmployees: lines.length,
        totalRemuneration,
        totalUifContribution,
        employerContribution: employerTotal,
        employeeContribution: employeeTotal,
        status: 'draft',
        createdBy: userId,
        lines: {
          create: lines.map(line => ({
            employeeId: line.employeeId,
            idNumber: line.idNumber,
            remuneration: line.remuneration,
            uifRemuneration: line.uifRemuneration,
            employerContribution: line.employerContribution,
            employeeContribution: line.employeeContribution,
            totalContribution: line.totalContribution,
          })),
        },
      },
    });

    this.logger.log(`Generated UIF declaration ${declaration.id} for period ${period}`);
    return declaration.id;
  }

  // Get UIF declaration
  async getDeclaration(declarationId: string): Promise<any> {
    return this.prisma.uIFDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        legalEntity: true,
        lines: true,
      },
    });
  }

  // Get UIF declarations for legal entity
  async getDeclarations(
    legalEntityId: string,
    filters?: { period?: string; status?: string; limit?: number },
  ): Promise<any[]> {
    const where: any = { legalEntityId };

    if (filters?.period) {
      where.declarationPeriod = filters.period;
    }
    if (filters?.status) {
      where.status = filters.status;
    }

    return this.prisma.uIFDeclaration.findMany({
      where,
      orderBy: { declarationPeriod: 'desc' },
      take: filters?.limit || 12,
    });
  }

  // Submit UIF declaration
  async submitDeclaration(declarationId: string, userId: string): Promise<void> {
    await this.prisma.uIFDeclaration.update({
      where: { id: declarationId },
      data: {
        status: 'submitted',
        submittedBy: userId,
        submittedAt: new Date(),
      },
    });

    this.logger.log(`UIF declaration ${declarationId} submitted`);
  }

  // Export UIF declaration to CSV
  async exportToCSV(declarationId: string): Promise<string> {
    const declaration = await this.prisma.uIFDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        lines: true,
      },
    });

    if (!declaration) {
      throw new Error('Declaration not found');
    }

    const headers = ['ID Number', 'Remuneration', 'UIF Remuneration', 'Employee Contribution', 'Employer Contribution', 'Total'];
    const rows = declaration.lines.map(line => [
      line.idNumber || '',
      line.remuneration.toString(),
      line.uifRemuneration.toString(),
      line.employeeContribution.toString(),
      line.employerContribution.toString(),
      line.totalContribution.toString(),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Get UIF summary for period range
  async getUifSummary(legalEntityId: string, startPeriod: string, endPeriod: string): Promise<any> {
    const declarations = await this.prisma.uIFDeclaration.findMany({
      where: {
        legalEntityId,
        declarationPeriod: { gte: startPeriod, lte: endPeriod },
      },
      orderBy: { declarationPeriod: 'asc' },
    });

    return {
      periodCount: declarations.length,
      totalEmployees: declarations.reduce((sum, d) => sum + d.totalEmployees, 0),
      totalRemuneration: declarations.reduce((sum, d) => sum + Number(d.totalRemuneration), 0),
      totalUifContribution: declarations.reduce((sum, d) => sum + Number(d.totalUifContribution), 0),
      declarations: declarations.map(d => ({
        period: d.declarationPeriod,
        employees: d.totalEmployees,
        contribution: Number(d.totalUifContribution),
        status: d.status,
      })),
    };
  }

  // Delete UIF declaration (only if draft)
  async deleteDeclaration(declarationId: string, userId: string): Promise<void> {
    const declaration = await this.prisma.uIFDeclaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration) {
      throw new Error('Declaration not found');
    }

    if (declaration.status !== 'draft') {
      throw new Error('Can only delete draft declarations');
    }

    await this.prisma.uIFDeclaration.delete({
      where: { id: declarationId },
    });

    this.logger.log(`UIF declaration ${declarationId} deleted by ${userId}`);
  }
}
