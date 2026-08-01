import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

interface SDLCalculation {
  totalRemuneration: number;
  leviableAmount: number;
  sdlLevy: number;
}

export interface SDLDeclarationSummary {
  id: string;
  declarationPeriod: string;
  totalEmployees: number;
  totalLeviableAmount: number;
  sdlLevy: number;
  status: string;
  isExempt: boolean;
}

@Injectable()
export class SdlService {
  private readonly logger = new Logger(SdlService.name);
  private readonly SDL_RATE = 0.01;
  private readonly SDL_ANNUAL_THRESHOLD = 500000.0;

  constructor(private readonly prisma: PrismaService) { }

  // Calculate SDL for a given remuneration amount
  calculateSDL(remuneration: number): SDLCalculation {
    const leviableAmount = remuneration;
    const sdlLevy = leviableAmount * this.SDL_RATE;

    return {
      totalRemuneration: remuneration,
      leviableAmount,
      sdlLevy: Math.round(sdlLevy * 100) / 100,
    };
  }

  // Check if employer is exempt from SDL
  async checkExemption(legalEntityId: string, period: string): Promise<boolean> {
    // Get annual payroll to check threshold
    const year = period.substring(0, 4);
    const startPeriod = `${year}-01`;
    const endPeriod = `${year}-12`;

    const declarations = await this.prisma.sDLDeclaration.findMany({
      where: {
        legalEntityId,
        declarationPeriod: { gte: startPeriod, lte: endPeriod },
      },
    });

    const annualPayroll = declarations.reduce((sum, d) => sum + Number(d.totalRemuneration), 0);
    return annualPayroll < this.SDL_ANNUAL_THRESHOLD;
  }

  // Generate SDL declaration for a period
  async generateDeclaration(
    legalEntityId: string,
    period: string,
    userId: string,
  ): Promise<string> {
    const isExempt = await this.checkExemption(legalEntityId, period);

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
            employeeResults: true,
          },
        },
      },
    });

    const lines: { employeeId: string; remuneration: number; leviableAmount: number; sdlLevy: number }[] = [];
    let totalRemuneration = 0;
    let totalLeviable = 0;
    let totalLevy = 0;

    for (const payGroup of payGroups) {
      for (const payRun of payGroup.payRuns) {
        for (const result of payRun.employeeResults) {
          const remuneration = Number(result.gross);
          const sdl = this.calculateSDL(remuneration);

          lines.push({
            employeeId: result.employeeId,
            remuneration: sdl.totalRemuneration,
            leviableAmount: sdl.leviableAmount,
            sdlLevy: isExempt ? 0 : sdl.sdlLevy,
          });

          totalRemuneration += sdl.totalRemuneration;
          totalLeviable += sdl.leviableAmount;
          totalLevy += isExempt ? 0 : sdl.sdlLevy;
        }
      }
    }

    const declaration = await this.prisma.sDLDeclaration.create({
      data: {
        legalEntityId,
        declarationPeriod: period,
        totalEmployees: lines.length,
        totalRemuneration,
        leviableAmount: totalLeviable,
        sdlLevy: totalLevy,
        isExempt,
        exemptionReason: isExempt ? 'Annual payroll below threshold' : null,
        status: 'draft',
        createdBy: userId,
        lines: {
          create: lines.map(line => ({
            employeeId: line.employeeId,
            remuneration: line.remuneration,
            leviableAmount: line.leviableAmount,
            sdlLevy: line.sdlLevy,
          })),
        },
      },
    });

    this.logger.log(`Generated SDL declaration ${declaration.id} for period ${period}`);
    return declaration.id;
  }

  // Get SDL declaration
  async getDeclaration(declarationId: string): Promise<any> {
    return this.prisma.sDLDeclaration.findUnique({
      where: { id: declarationId },
      include: {
        legalEntity: true,
        lines: true,
      },
    });
  }

  // Get SDL declarations for legal entity
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

    return this.prisma.sDLDeclaration.findMany({
      where,
      orderBy: { declarationPeriod: 'desc' },
      take: filters?.limit || 12,
    });
  }

  // Submit SDL declaration
  async submitDeclaration(declarationId: string, userId: string): Promise<void> {
    await this.prisma.sDLDeclaration.update({
      where: { id: declarationId },
      data: {
        status: 'submitted',
        submittedBy: userId,
        submittedAt: new Date(),
      },
    });

    this.logger.log(`SDL declaration ${declarationId} submitted`);
  }

  // Record payment
  async recordPayment(declarationId: string, paymentReference: string, userId: string): Promise<void> {
    await this.prisma.sDLDeclaration.update({
      where: { id: declarationId },
      data: {
        status: 'paid',
        paymentReference,
        paidAt: new Date(),
      },
    });

    this.logger.log(`SDL payment recorded for declaration ${declarationId}`);
  }

  // Export SDL declaration to CSV
  async exportToCSV(declarationId: string): Promise<string> {
    const declaration = await this.prisma.sDLDeclaration.findUnique({
      where: { id: declarationId },
      include: { lines: true },
    });

    if (!declaration) {
      throw new Error('Declaration not found');
    }

    const headers = ['Employee ID', 'Remuneration', 'Leviable Amount', 'SDL Levy'];
    const rows = declaration.lines.map(line => [
      line.employeeId,
      line.remuneration.toString(),
      line.leviableAmount.toString(),
      line.sdlLevy.toString(),
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  }

  // Get SDL summary for period range
  async getSdlSummary(legalEntityId: string, startPeriod: string, endPeriod: string): Promise<any> {
    const declarations = await this.prisma.sDLDeclaration.findMany({
      where: {
        legalEntityId,
        declarationPeriod: { gte: startPeriod, lte: endPeriod },
      },
      orderBy: { declarationPeriod: 'asc' },
    });

    return {
      periodCount: declarations.length,
      totalRemuneration: declarations.reduce((sum, d) => sum + Number(d.totalRemuneration), 0),
      totalLevy: declarations.reduce((sum, d) => sum + Number(d.sdlLevy), 0),
      exemptPeriods: declarations.filter(d => d.isExempt).length,
      declarations: declarations.map(d => ({
        period: d.declarationPeriod,
        levy: Number(d.sdlLevy),
        isExempt: d.isExempt,
        status: d.status,
      })),
    };
  }

  // Delete SDL declaration (only if draft)
  async deleteDeclaration(declarationId: string, userId: string): Promise<void> {
    const declaration = await this.prisma.sDLDeclaration.findUnique({
      where: { id: declarationId },
    });

    if (!declaration) {
      throw new Error('Declaration not found');
    }

    if (declaration.status !== 'draft') {
      throw new Error('Can only delete draft declarations');
    }

    await this.prisma.sDLDeclaration.delete({
      where: { id: declarationId },
    });

    this.logger.log(`SDL declaration ${declarationId} deleted by ${userId}`);
  }
}
