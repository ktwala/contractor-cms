import { Injectable } from '@nestjs/common';
import {
  PayslipTemplateInput,
  PayslipTemplateVariant,
} from './payslip-template.interface';

/** Strip emails and phone numbers from address - employer section shows physical address only */
function addressOnly(addr: string | undefined): string | undefined {
  if (!addr) return undefined;
  const parts = addr.split(/[\n|]+/).map((s) => s.trim()).filter((s) => {
    if (!s) return false;
    if (s.includes('@')) return false; // email
    if (/^(tel|phone|fax|mobile)[:\s]/i.test(s)) return false;
    if (/^[\d\s\-+()]+$/.test(s.replace(/\s/g, '')) && s.replace(/\D/g, '').length >= 8) return false; // phone-only
    return true;
  });
  return parts.join(', ').trim() || undefined;
}

/**
 * Shared payslip HTML template service.
 * Supports two variants: 'schedule' (new) and 'legacy' (old).
 * Layout: separated sections (employer + payment in header, employee in own section) - no grouping.
 * Employer section: physical address only, no emails/phone.
 */
@Injectable()
export class PayslipTemplateService {
  /**
   * Generate payslip HTML. Use variant to choose template.
   * @param input Payslip data
   * @param variant 'schedule' (default) or 'legacy'
   */
  render(input: PayslipTemplateInput, variant: PayslipTemplateVariant = 'schedule'): string {
    return variant === 'legacy' ? this.renderLegacy(input) : this.renderSchedule(input);
  }

  /**
   * Legacy payslip format: PAYSLIP title, Earnings with Units/Rate, YTD section, summary boxes.
   */
  renderLegacy(input: PayslipTemplateInput): string {
    const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const orDash = (v: string | undefined) => (v != null && v !== '' ? v : '—');

    const earningsRows = input.earnings
      .map(
        (e) =>
          `<tr><td>${e.description}</td><td class="right">1</td><td class="right">${fmt(e.amount)}</td><td class="right">${fmt(e.amount)}</td></tr>`,
      )
      .join('');
    const deductionsRows = input.deductions
      .map((d) => `<tr><td>${d.description} *</td><td class="right">${fmt(d.amount)}</td></tr>`)
      .join('');

    const ytdGross = input.ytd_gross ?? input.gross;
    const ytdPaye = input.ytd_paye ?? input.total_deductions;
    const ytdNet = input.ytd_net ?? input.net;

    const logoHtml = input.logo_url
      ? `<div class="logo-corner"><img src="${input.logo_url}" alt="Logo"></div>`
      : '';
    const companyAddr = addressOnly(input.company_address);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${input.employee_name} - ${input.payrun_period_start} to ${input.payrun_period_end}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    .logo-corner img { height: 40px; }
    .doc-title { font-size: 0.95em; font-weight: 600; color: #333; }
    .header { display: flex; justify-content: space-between; margin-bottom: 20px; }
    .header-left { }
    .header-right { text-align: right; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; background: #f0f0f0; padding: 5px 10px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .right { text-align: right; }
    .total { font-weight: bold; background: #f9f9f9; }
    .summary { display: flex; justify-content: space-between; margin-top: 30px; padding: 20px; background: #f0f0f0; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 24px; font-weight: bold; color: #333; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header-row">
    <div>${logoHtml}</div>
    <div class="doc-title">PAYSLIP</div>
  </div>

  <div class="header">
    <div class="header-left">
      <strong>${input.company_name.toLowerCase().includes('hubsec') ? input.company_name.toUpperCase() : input.company_name}</strong><br>
      ${companyAddr ? `${companyAddr}<br>` : ''}
    </div>
    <div class="header-right">
      <strong>Pay Period:</strong> ${input.payrun_period_start} to ${input.payrun_period_end}<br>
      <strong>Pay Date:</strong> ${input.pay_date}<br>
      <strong>Pay Frequency:</strong> Monthly
    </div>
  </div>

  <div class="section">
    <div class="section-title">Employee Details</div>
    <table>
      <tr>
        <td><strong>Name:</strong> ${input.employee_name}</td>
        <td><strong>Employee #:</strong> ${input.employee_number}</td>
      </tr>
      <tr>
        <td><strong>Department:</strong> ${orDash(input.department)}</td>
        <td><strong>Job Title:</strong> ${orDash(input.job_title)}</td>
      </tr>
      <tr>
        <td><strong>Tax Reference:</strong> ${orDash(input.tax_reference)}</td>
        <td></td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Earnings</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Units</th>
          <th class="right">Rate</th>
          <th class="right">Amount (${input.currency})</th>
        </tr>
      </thead>
      <tbody>
        ${earningsRows}
        <tr class="total">
          <td colspan="3">Total Earnings</td>
          <td class="right">${fmt(input.gross)}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Deductions</div>
    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Amount (${input.currency})</th>
        </tr>
      </thead>
      <tbody>
        ${deductionsRows}
        <tr class="total">
          <td>Total Deductions</td>
          <td class="right">${fmt(input.total_deductions)}</td>
        </tr>
      </tbody>
    </table>
    <p style="font-size: 12px; color: #666;">* Statutory deductions</p>
  </div>

  <div class="summary">
    <div class="summary-item">
      <div>Gross Pay</div>
      <div class="summary-value">${input.currency} ${fmt(input.gross)}</div>
    </div>
    <div class="summary-item">
      <div>Total Deductions</div>
      <div class="summary-value">${input.currency} ${fmt(input.total_deductions)}</div>
    </div>
    <div class="summary-item">
      <div>Net Pay</div>
      <div class="summary-value" style="color: #2e7d32;">${input.currency} ${fmt(input.net)}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Year-to-Date</div>
    <table>
      <tr>
        <td><strong>YTD Gross:</strong></td>
        <td class="right">${input.currency} ${fmt(ytdGross)}</td>
        <td><strong>YTD PAYE:</strong></td>
        <td class="right">${input.currency} ${fmt(ytdPaye)}</td>
        <td><strong>YTD Net:</strong></td>
        <td class="right">${input.currency} ${fmt(ytdNet)}</td>
      </tr>
    </table>
  </div>
  ${input.bank_name || input.account_number ? `
  <div class="section">
    <div class="section-title">Payment Details</div>
    <table>
      <tr>
        <td><strong>Bank:</strong> ${orDash(input.bank_name)}</td>
        <td><strong>Account:</strong> ${orDash(input.account_number)}</td>
      </tr>
    </table>
  </div>` : ''}

  <div class="footer">
    This is a computer-generated payslip. Please retain for your records.
  </div>
</body>
</html>`;
  }

  /**
   * Schedule of Remuneration format: separated sections (employer+payment header, employee, banking).
   */
  private renderSchedule(input: PayslipTemplateInput): string {
    const fmt = (n: number) => n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const orDash = (v: string | undefined) => (v != null && v !== '' ? v : '—');

    const earningsRows = input.earnings
      .map((e) => `<tr><td>${e.description}</td><td class="right">${fmt(e.amount)}</td></tr>`)
      .join('');
    const deductionsRows = input.deductions
      .map((d) => `<tr><td>${d.description}</td><td class="right">${fmt(d.amount)}</td></tr>`)
      .join('');

    const periodLabel = input.period_label || `${input.payrun_period_start} - ${input.payrun_period_end}`;
    const logoHtml = input.logo_url
      ? `<div class="logo-corner"><img src="${input.logo_url}" alt="Logo"></div>`
      : '';
    const companyAddr = addressOnly(input.company_address);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Schedule of Remuneration - ${input.employee_name} - ${periodLabel}</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 920px; margin: 0 auto; padding: 24px; color: #2c2c2c; background: #fafafa; }
    .header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; border-bottom: 1px solid #d0d0d0; padding-bottom: 12px; }
    .logo-corner img { height: 40px; }
    .doc-title { font-size: 0.95em; font-weight: 600; color: #333; }
    .period-sub { font-size: 0.85em; color: #666; margin-top: 2px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 24px; padding-bottom: 20px; border-bottom: 1px solid #d0d0d0; }
    .header-left { }
    .header-right { text-align: right; }
    .section { margin: 20px 0; }
    .section-title { font-weight: 600; padding: 8px 0; margin-bottom: 0; font-size: 0.9em; border-bottom: 1px solid #d0d0d0; color: #333; }
    .info-table { width: 100%; border-collapse: collapse; }
    .info-table td { padding: 6px 0; font-size: 0.88em; border: none; vertical-align: top; }
    .info-table td:first-child { color: #555; width: 42%; }
    .earnings-deductions { display: flex; gap: 24px; margin: 24px 0; }
    .earnings-deductions > div { flex: 1; }
    .amount-table { width: 100%; border-collapse: collapse; }
    .amount-table th, .amount-table td { padding: 10px 12px; text-align: left; border-bottom: 1px solid #e8e8e8; font-size: 0.9em; }
    .amount-table th { font-weight: 600; color: #555; }
    .right { text-align: right; }
    .total { font-weight: 600; background: #f5f5f5; }
    .net-pay-box { text-align: center; margin: 28px 0; padding: 20px; background: linear-gradient(180deg, #f8fcf8 0%, #eef6ee 100%); border: 1px solid #c8e0c8; border-radius: 4px; }
    .net-pay-box .label { font-size: 0.85em; color: #666; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 4px; }
    .net-pay-box .amount { font-size: 1.75em; font-weight: 700; color: #1a6b1a; letter-spacing: 0.02em; }
    .footer { margin-top: 32px; font-size: 11px; color: #888; text-align: center; padding-top: 16px; border-top: 1px solid #e0e0e0; }
    .confidential { font-style: italic; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header-row">
    <div>${logoHtml}</div>
    <div>
      <div class="doc-title">Schedule of Remuneration</div>
      <div class="period-sub">${periodLabel}</div>
    </div>
  </div>

  <div class="header">
    <div class="header-left">
      <strong>${input.company_name.toLowerCase().includes('hubsec') ? input.company_name.toUpperCase() : input.company_name}</strong><br>
      ${companyAddr ? `<span style="font-size: 0.9em; color: #666;">${companyAddr}</span>` : ''}
    </div>
    <div class="header-right">
      <strong>Pay Period:</strong> ${input.payrun_period_start} to ${input.payrun_period_end}<br>
      <strong>Pay Date:</strong> ${input.pay_date}<br>
      <strong>Pay Frequency:</strong> Monthly
    </div>
  </div>

  <div class="section">
    <div class="section-title">Employee Info</div>
    <table class="info-table">
      <tr><td>Name:</td><td>${input.employee_name}</td></tr>
      <tr><td>Emp No.:</td><td>${input.employee_number}</td></tr>
      <tr><td>Job Title:</td><td>${orDash(input.job_title)}</td></tr>
      <tr><td>Date Engaged:</td><td>${orDash(input.date_engaged)}</td></tr>
      <tr><td>ID No.:</td><td>${orDash(input.id_number)}</td></tr>
      <tr><td>DOB:</td><td>${orDash(input.date_of_birth)}</td></tr>
      <tr><td>Tax Ref No.:</td><td>${orDash(input.tax_reference)}</td></tr>
      <tr><td>Address:</td><td>${orDash(input.address)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Banking details</div>
    <table class="info-table">
      <tr><td>Bank Name:</td><td>${orDash(input.bank_name)}</td></tr>
      <tr><td>Branch / Code:</td><td>${[input.branch, input.branch_code].filter(Boolean).join(' / ') || '—'}</td></tr>
      <tr><td>Account No.:</td><td>${orDash(input.account_number)}</td></tr>
      <tr><td>Pay Date:</td><td>${input.pay_date}</td></tr>
      <tr><td>Payrun Period:</td><td>${input.payrun_period_start} TO ${input.payrun_period_end}</td></tr>
      <tr><td>Annual Package:</td><td>${orDash(input.annual_salary_package)} (${input.currency})</td></tr>
    </table>
  </div>

  <div class="earnings-deductions">
    <div>
      <div class="section-title">Earnings</div>
      <table class="amount-table">
        <tr><th>Description</th><th class="right">Amount (${input.currency})</th></tr>
        ${earningsRows}
        <tr class="total"><td>Total</td><td class="right">${fmt(input.gross)}</td></tr>
      </table>
    </div>
    <div>
      <div class="section-title">Deductions</div>
      <table class="amount-table">
        <tr><th>Description</th><th class="right">Amount (${input.currency})</th></tr>
        ${deductionsRows}
        <tr class="total"><td>Total</td><td class="right">${fmt(input.total_deductions)}</td></tr>
      </table>
    </div>
  </div>

  <div class="net-pay-box">
    <div class="label">Net Pay</div>
    <div class="amount">${fmt(input.net)} (${input.currency})</div>
  </div>

  <div class="footer">
    <p class="confidential">Confidential – Employment / Payslip</p>
    <p>Generated: ${new Date().toISOString().split('T')[0]}</p>
  </div>
</body>
</html>`;
  }
}
