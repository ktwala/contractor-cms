import { PayrollGovernancePortfolioEvidenceExportService } from '../services/payroll-governance-portfolio-evidence-export.service';
import { PayrollGovernancePortfolioService } from '../services/payroll-governance-portfolio.service';
import type { GovernancePortfolioSummaryDto } from '../dto/governance-portfolio-summary.dto';

describe('PayrollGovernancePortfolioEvidenceExportService (GOV-5C / GOV-5C-LOCK)', () => {
  const summary: GovernancePortfolioSummaryDto = {
    scope: 'period',
    scope_id: 'per-1',
    label: 'PG · 2026-1',
    total_payruns: 3,
    blocked_payruns_count: 1,
    stale_post_close_impact_count: 2,
    override_event_count: 4,
    financial_exception_payruns: 1,
    bank_exception_payruns: 0,
    gl_exception_payruns: 1,
    open_payrun_exceptions_count: 5,
  };

  const meta = { generated_at: '2026-05-07T12:00:00.000Z', generated_by: 'auditor@example.com (sub-1)' };

  it('buildEvidenceRow includes scope, timestamp, generated_by, blocked, overrides, 3A/3B/3C exceptions, stale GOV-4', () => {
    const portfolio = {} as PayrollGovernancePortfolioService;
    const svc = new PayrollGovernancePortfolioEvidenceExportService(portfolio);
    const row = svc.buildEvidenceRow(summary, meta);
    expect(row.generated_at).toBe(meta.generated_at);
    expect(row.generated_by).toBe(meta.generated_by);
    expect(row.scope).toBe('period');
    expect(row.scope_id).toBe('per-1');
    expect(row.blocked_payruns_count).toBe(1);
    expect(row.override_event_count).toBe(4);
    expect(row.stale_post_close_impact_count).toBe(2);
    expect(row.financial_exception_payruns).toBe(1);
    expect(row.bank_exception_payruns).toBe(0);
    expect(row.gl_exception_payruns).toBe(1);
  });

  it('encodeEvidenceReport produces CSV and XLSX buffers', () => {
    const portfolio = {} as PayrollGovernancePortfolioService;
    const svc = new PayrollGovernancePortfolioEvidenceExportService(portfolio);
    const csv = svc.encodeEvidenceReport('csv', summary, meta);
    expect(csv.toString('utf-8')).toContain('generated_at');
    expect(csv.toString('utf-8')).toContain('generated_by');
    expect(csv.toString('utf-8')).toContain('auditor@example.com');
    expect(csv.toString('utf-8')).toContain('blocked_payruns_count');

    const xlsx = svc.encodeEvidenceReport('xlsx', summary, meta);
    expect(xlsx.subarray(0, 2).toString('ascii')).toBe('PK');
  });
});
