import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { TtaException } from '../tax-table-authoring/types/error-codes';
import {
  RunImpactAnalysisDto,
  ImpactAnalysisBasisMode,
} from './dto/run-impact-analysis.dto';
import type { EmployeeTaxAnalysisBasis } from './types/tax-table-impact-analysis.types';

@Injectable()
export class TaxTableImpactAnalysisBasisService {
  constructor(private readonly prisma: PrismaService) {}

  async loadBasis(dto: RunImpactAnalysisDto): Promise<EmployeeTaxAnalysisBasis[]> {
    if (dto.basisMode === ImpactAnalysisBasisMode.PAYRUN_ID) {
      if (!dto.payrunId) {
        throw new TtaException('TTA_IMPACT_MISSING_PAYRUN', 'payrunId is required when basisMode is PAYRUN_ID', undefined, 400);
      }
      return this.loadFromPayrunId(dto.payrunId, dto);
    }

    if (!dto.payGroupId) {
      throw new TtaException('TTA_IMPACT_MISSING_PAYGROUP', 'payGroupId is required when basisMode is LAST_CLOSED_PAYRUN', undefined, 400);
    }
    return this.loadFromLastClosedPayrun(dto.payGroupId, dto);
  }

  private async loadFromLastClosedPayrun(
    payGroupId: string,
    dto: RunImpactAnalysisDto,
  ): Promise<EmployeeTaxAnalysisBasis[]> {
    const payrun = await this.prisma.payRun.findFirst({
      where: {
        payGroupId,
        status: 'CLOSED' as any,
      },
      orderBy: { payDate: 'desc' },
      include: { payGroup: true },
    });

    if (!payrun) {
      throw new TtaException(
        'TTA_IMPACT_NO_CLOSED_PAYRUN',
        'No closed payrun found for the selected pay group',
        undefined,
        404,
      );
    }

    return this.loadFromPayrunId(payrun.id, dto);
  }

  private async loadFromPayrunId(
    payrunId: string,
    dto: RunImpactAnalysisDto,
  ): Promise<EmployeeTaxAnalysisBasis[]> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { include: { legalEntity: true } },
      },
    });

    if (!payrun) {
      throw new TtaException('TTA_IMPACT_PAYRUN_NOT_FOUND', 'Payrun not found', undefined, 404);
    }

    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
      include: { employee: true },
      take: dto.limit ?? 500,
      orderBy: { employeeId: 'asc' },
    });

    const now = new Date();

    return results.map((row) => {
      const age = row.employee.dateOfBirth
        ? this.calculateAge(row.employee.dateOfBirth, now)
        : null;

      return {
        employeeId: row.employeeId,
        employeeNumber: row.employee.employeeNo ?? null,
        employeeName:
          `${row.employee.firstName ?? ''} ${row.employee.lastName ?? ''}`.trim() || null,
        legalEntityId: row.employee.legalEntityId ?? payrun.payGroup.legalEntityId ?? null,
        legalEntityName: payrun.payGroup.legalEntity?.name ?? null,
        payGroupId: payrun.payGroupId,
        payGroupName: payrun.payGroup.name ?? null,
        countryCode: dto.countryCode,
        age,

        sourcePayrunId: payrun.id,
        sourcePeriodStart: payrun.periodStart?.toISOString() ?? '',
        sourcePeriodEnd: payrun.periodEnd?.toISOString() ?? '',
        sourcePayDate: payrun.payDate?.toISOString() ?? '',

        taxRelevantInputs: {
          taxableEarnings: Number(row.taxableIncome ?? 0),
          preTaxDeductions: Math.max(0, Number(row.gross ?? 0) - Number(row.taxableIncome ?? 0)),
          fringeBenefits: 0,
          retirementDeduction: 0,
          medicalCreditDependants: null,
          additional: {},
        },
      };
    });
  }

  private calculateAge(dateOfBirth: Date, referenceDate: Date): number {
    let age = referenceDate.getFullYear() - dateOfBirth.getFullYear();
    const m = referenceDate.getMonth() - dateOfBirth.getMonth();
    if (m < 0 || (m === 0 && referenceDate.getDate() < dateOfBirth.getDate())) {
      age--;
    }
    return age;
  }
}
