import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { PayrollResultNormalizerService } from './payroll-result-normalizer.service';
import { PayrollDisplaySchemaRegistry } from './payroll-display-schema.registry';
import {
  PayrollPayrunResultsResponse,
  PayrollEmployeeResult,
} from './payroll-result.types';

@Injectable()
export class PayrollResultsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly normalizer: PayrollResultNormalizerService,
    private readonly schemaRegistry: PayrollDisplaySchemaRegistry,
  ) {}

  async getPayrunResults(
    payrunId: string,
    offset = 0,
    limit = 100,
  ): Promise<PayrollPayrunResultsResponse> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: true,
        context: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    const countryCode = payrun.payGroup.country;
    const currency = payrun.payGroup.currency;
    const displaySchema = this.schemaRegistry.get(countryCode);

    const packVersion = (payrun.context as any)?.packVersion;
    const ctx = {
      country_code: countryCode,
      currency,
      source_pack: packVersion ? `${countryCode}.${packVersion}` : `${countryCode}.v1`,
    };

    const dbResults = await this.prisma.employeeResult.findMany({
      where: { payrunId },
      include: {
        employee: true,
        payLines: { include: { payItem: true } },
      },
      skip: offset,
      take: limit,
      orderBy: { employee: { employeeNo: 'asc' } },
    });

    const rawResults = dbResults.map((r) => ({
      employee_id: r.employeeId,
      employee_code: r.employee?.employeeNo || undefined,
      employee_number: r.employee?.employeeNo || undefined,
      employee_name: [r.employee?.firstName, r.employee?.lastName].filter(Boolean).join(' ') || undefined,
      gross: Number(r.gross),
      taxable_income: Number(r.taxableIncome),
      paye: Number(r.paye),
      net: Number(r.net),
      lines: r.payLines.map((pl) => ({
        code: pl.payItem?.code || 'UNKNOWN',
        name: pl.payItem?.name || undefined,
        type: pl.type,
        amount: Number(pl.amount),
        trace: pl.meta as Record<string, any> | undefined,
      })),
    }));

    const employeeResults = this.normalizer.normalize(ctx, rawResults);
    const totals = this.aggregateTotals(employeeResults);
    const statutoryTotals = this.normalizer.buildStatutoryTotals(employeeResults);

    return {
      payrun_id: payrunId,
      pay_group_id: payrun.payGroupId,
      country_code: countryCode,
      currency,
      display_schema: displaySchema,
      employee_results: employeeResults,
      totals,
      statutory_totals: statutoryTotals,
    };
  }

  async getEmployeeResultDetail(
    payrunId: string,
    employeeId: string,
  ): Promise<PayrollEmployeeResult> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: { payGroup: true, context: true },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    const result = await this.prisma.employeeResult.findUnique({
      where: { payrunId_employeeId: { payrunId, employeeId } },
      include: {
        employee: true,
        payLines: { include: { payItem: true } },
      },
    });

    if (!result) {
      throw new NotFoundException(`No result found for employee ${employeeId}`);
    }

    const packVersion = (payrun.context as any)?.packVersion;
    const ctx = {
      country_code: payrun.payGroup.country,
      currency: payrun.payGroup.currency,
      source_pack: packVersion ? `${payrun.payGroup.country}.${packVersion}` : `${payrun.payGroup.country}.v1`,
    };

    const raw = {
      employee_id: result.employeeId,
      employee_code: result.employee?.employeeNo || undefined,
      employee_number: result.employee?.employeeNo || undefined,
      employee_name: [result.employee?.firstName, result.employee?.lastName].filter(Boolean).join(' ') || undefined,
      gross: Number(result.gross),
      taxable_income: Number(result.taxableIncome),
      paye: Number(result.paye),
      net: Number(result.net),
      lines: result.payLines.map((pl) => ({
        code: pl.payItem?.code || 'UNKNOWN',
        name: pl.payItem?.name || undefined,
        type: pl.type,
        amount: Number(pl.amount),
        trace: pl.meta as Record<string, any> | undefined,
      })),
    };

    const [normalized] = this.normalizer.normalize(ctx, [raw]);

    return normalized;
  }

  private aggregateTotals(results: PayrollEmployeeResult[]): PayrollPayrunResultsResponse['totals'] {
    const summaryLineTotals: Record<string, number> = {};

    for (const r of results) {
      for (const [code, amount] of Object.entries(r.summary_line_amounts)) {
        summaryLineTotals[code] = (summaryLineTotals[code] ?? 0) + amount;
      }
    }

    return {
      gross: results.reduce((s, r) => s + r.gross, 0),
      earnings_total: results.reduce((s, r) => s + r.earnings_total, 0),
      employee_deductions_total: results.reduce((s, r) => s + r.employee_deductions_total, 0),
      employer_contributions_total: results.reduce((s, r) => s + r.employer_contributions_total, 0),
      employer_levies_total: results.reduce((s, r) => s + r.employer_levies_total, 0),
      net_pay: results.reduce((s, r) => s + r.net_pay, 0),
      employer_cost: results.reduce((s, r) => s + r.employer_cost, 0),
      summary_line_totals: summaryLineTotals,
    };
  }
}
