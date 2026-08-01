import { BadRequestException, Injectable } from '@nestjs/common';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import type { GovernancePortfolioSummaryDto } from '../dto/governance-portfolio-summary.dto';
import { PayrollGovernancePortfolioService, type PortfolioGateUser } from './payroll-governance-portfolio.service';

export type GovernanceEvidenceFormat = 'csv' | 'xlsx';

export type GovernancePortfolioEvidenceMeta = {
  generated_at: string;
  generated_by: string;
};

@Injectable()
export class PayrollGovernancePortfolioEvidenceExportService {
  constructor(private readonly portfolio: PayrollGovernancePortfolioService) {}

  buildEvidenceRow(summary: GovernancePortfolioSummaryDto, meta: GovernancePortfolioEvidenceMeta): Record<string, string | number> {
    return {
      generated_at: meta.generated_at,
      generated_by: meta.generated_by,
      scope: summary.scope,
      scope_id: summary.scope_id,
      label: summary.label ?? '',
      total_payruns: summary.total_payruns,
      blocked_payruns_count: summary.blocked_payruns_count,
      stale_post_close_impact_count: summary.stale_post_close_impact_count,
      override_event_count: summary.override_event_count,
      financial_exception_payruns: summary.financial_exception_payruns,
      bank_exception_payruns: summary.bank_exception_payruns,
      gl_exception_payruns: summary.gl_exception_payruns,
      open_payrun_exceptions_count: summary.open_payrun_exceptions_count,
    };
  }

  encodeEvidenceReport(format: GovernanceEvidenceFormat, summary: GovernancePortfolioSummaryDto, meta: GovernancePortfolioEvidenceMeta): Buffer {
    const row = this.buildEvidenceRow(summary, meta);
    const rows = [row];
    if (format === 'csv') {
      const csv = Papa.unparse(rows, { header: true, quotes: true });
      return Buffer.from(csv, 'utf-8');
    }
    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Governance evidence');
      return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as ArrayBuffer);
    }
    throw new BadRequestException({ code: 'UNSUPPORTED_FORMAT', message: 'format must be csv or xlsx' });
  }

  async exportPeriodEvidence(
    periodId: string,
    user: PortfolioGateUser,
    generatedBy: string,
    format: GovernanceEvidenceFormat,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const summary = await this.portfolio.summarizePeriod(periodId, user);
    return this.pack(summary, 'period', periodId, generatedBy, format);
  }

  async exportPayGroupEvidence(
    payGroupId: string,
    user: PortfolioGateUser,
    generatedBy: string,
    format: GovernanceEvidenceFormat,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const summary = await this.portfolio.summarizePayGroup(payGroupId, user);
    return this.pack(summary, 'pay_group', payGroupId, generatedBy, format);
  }

  async exportLegalEntityEvidence(
    legalEntityId: string,
    user: PortfolioGateUser,
    generatedBy: string,
    format: GovernanceEvidenceFormat,
  ): Promise<{ buffer: Buffer; filename: string; contentType: string }> {
    const summary = await this.portfolio.summarizeLegalEntity(legalEntityId, user);
    return this.pack(summary, 'legal_entity', legalEntityId, generatedBy, format);
  }

  private pack(
    summary: GovernancePortfolioSummaryDto,
    scopeKind: string,
    scopeKey: string,
    generatedBy: string,
    format: GovernanceEvidenceFormat,
  ): { buffer: Buffer; filename: string; contentType: string } {
    const meta: GovernancePortfolioEvidenceMeta = {
      generated_at: new Date().toISOString(),
      generated_by: generatedBy,
    };
    const buffer = this.encodeEvidenceReport(format, summary, meta);
    const safeKey = scopeKey.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 64);
    const ext = format === 'xlsx' ? 'xlsx' : 'csv';
    const filename = `governance_portfolio_evidence_${scopeKind}_${safeKey}.${ext}`;
    const contentType =
      format === 'xlsx'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv; charset=utf-8';
    return { buffer, filename, contentType };
  }
}
