import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { SelfServiceService } from './self-service.service';
import { PayslipTemplateService } from '../../core/payslip/payslip-template.service';
import { PayslipPdfService } from '../../core/payslip/pdf.service';
import {
  PayslipQueryDto,
  PayslipDetailDto,
  PayslipListResponseDto,
  TaxCertificateQueryDto,
  TaxCertificateDetailDto,
  TaxCertificateListResponseDto,
  EmployeeProfileDto,
  UpdateContactInfoDto,
  BankAccountUpdateRequestDto,
  DownloadPayslipDto,
  DownloadTaxCertificateDto,
  DocumentFormat,
  PayslipTemplateVariant,
} from './dto/self-service.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('self-service')
export class SelfServiceController {
  constructor(
    private readonly selfServiceService: SelfServiceService,
    private readonly payslipTemplateService: PayslipTemplateService,
    private readonly payslipPdfService: PayslipPdfService,
    private readonly configService: ConfigService,
  ) { }

  // ============================================================================
  // Profile
  // ============================================================================

  @Get('profile')
  @Permissions('self_service:read')
  async getProfile(@CurrentUser('sub') userId: string): Promise<EmployeeProfileDto> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.getProfile(employeeId);
  }

  @Post('profile/contact')
  @HttpCode(HttpStatus.OK)
  @Permissions('self_service:update')
  async requestContactUpdate(
    @CurrentUser('sub') userId: string,
    @Body() dto: UpdateContactInfoDto,
  ): Promise<{ request_id: string; message: string }> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.requestContactUpdate(employeeId, dto, userId);
  }

  @Post('profile/bank-account')
  @HttpCode(HttpStatus.OK)
  @Permissions('self_service:update')
  async requestBankAccountUpdate(
    @CurrentUser('sub') userId: string,
    @Body() dto: BankAccountUpdateRequestDto,
  ): Promise<{ request_id: string; message: string }> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.requestBankAccountUpdate(employeeId, dto, userId);
  }

  // ============================================================================
  // Payslips
  // ============================================================================

  @Get('payslips')
  @Permissions('self_service:read')
  async listPayslips(
    @CurrentUser('sub') userId: string,
    @Query() query: PayslipQueryDto,
  ): Promise<PayslipListResponseDto> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.listPayslips(employeeId, query);
  }

  @Get('payslips/:id')
  @Permissions('self_service:read')
  async getPayslip(
    @CurrentUser('sub') userId: string,
    @Param('id') payslipId: string,
  ): Promise<PayslipDetailDto> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.getPayslip(employeeId, payslipId);
  }

  @Get('payslips/:id/download')
  @Permissions('self_service:read')
  async downloadPayslip(
    @CurrentUser('sub') userId: string,
    @Param('id') payslipId: string,
    @Query() query: DownloadPayslipDto,
    @Res() res: Response,
  ): Promise<void> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    const payslip = await this.selfServiceService.getPayslip(employeeId, payslipId);

    const format = query.format || DocumentFormat.PDF;

    if (format === DocumentFormat.PDF) {
      const pdfBuffer = await this.payslipPdfService.generate(payslip);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.period_end}.pdf"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } else {
      const variant: PayslipTemplateVariant = query.template || 'schedule';
      const html = this.payslipTemplateService.render(this.toTemplateInput(payslip), variant);
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename="payslip-${payslip.period_end}.html"`);
      res.send(html);
    }
  }

  private toTemplateInput(payslip: PayslipDetailDto) {
    const periodLabel = payslip.period_end
      ? new Date(payslip.period_end + 'T12:00:00').toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
      : payslip.period_start + ' - ' + payslip.period_end;
    const annualSalary =
      payslip.pay_frequency === 'MONTHLY'
        ? (payslip.gross * 12).toFixed(2)
        : undefined;
    return {
      company_name: payslip.company_name,
      company_address: payslip.company_address,
      employee_name: payslip.employee_name,
      employee_number: payslip.employee_number,
      job_title: payslip.job_title,
      date_engaged: payslip.date_engaged,
      id_number: payslip.id_number,
      date_of_birth: payslip.date_of_birth,
      tax_reference: payslip.tax_reference,
      address: payslip.address,
      bank_name: payslip.bank_name,
      branch: payslip.branch,
      branch_code: payslip.branch_code,
      account_number: payslip.account_number_masked,
      pay_method: 'EFT',
      pay_date: payslip.pay_date.replace(/-/g, '/'),
      payrun_period_start: payslip.period_start.replace(/-/g, '/'),
      payrun_period_end: payslip.period_end.replace(/-/g, '/'),
      working_hours_per_week: '40.00',
      annual_salary_package: annualSalary,
      earnings: payslip.earnings.map((e) => ({ description: e.name, amount: e.amount })),
      deductions: payslip.deductions.map((d) => ({ description: d.name, amount: d.amount })),
      gross: payslip.gross,
      total_deductions: payslip.total_deductions,
      net: payslip.net,
      currency: payslip.currency,
      period_label: periodLabel,
      logo_url: this.configService.get<string>('payslip.logoUrl') || undefined,
    };
  }

  // ============================================================================
  // Tax Certificates
  // ============================================================================

  @Get('tax-certificates')
  @Permissions('self_service:read')
  async listTaxCertificates(
    @CurrentUser('sub') userId: string,
    @Query() query: TaxCertificateQueryDto,
  ): Promise<TaxCertificateListResponseDto> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.listTaxCertificates(employeeId, query);
  }

  @Get('tax-certificates/:id')
  @Permissions('self_service:read')
  async getTaxCertificate(
    @CurrentUser('sub') userId: string,
    @Param('id') certificateId: string,
  ): Promise<TaxCertificateDetailDto> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.getTaxCertificate(employeeId, certificateId);
  }

  @Post('tax-certificates/generate')
  @HttpCode(HttpStatus.CREATED)
  @Permissions('self_service:read')
  async generateTaxCertificate(
    @CurrentUser('sub') userId: string,
    @Body('tax_year') taxYear: string,
  ): Promise<TaxCertificateDetailDto> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    return this.selfServiceService.generateTaxCertificate(employeeId, taxYear);
  }

  @Get('tax-certificates/:id/download')
  @Permissions('self_service:read')
  async downloadTaxCertificate(
    @CurrentUser('sub') userId: string,
    @Param('id') certificateId: string,
    @Query() query: DownloadTaxCertificateDto,
    @Res() res: Response,
  ): Promise<void> {
    const employeeId = await this.selfServiceService.getEmployeeIdForUser(userId);
    const cert = await this.selfServiceService.getTaxCertificate(employeeId, certificateId);

    const html = this.generateTaxCertificateHtml(cert);
    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="tax-certificate-${cert.tax_year}.html"`);
    res.send(html);
  }

  // ============================================================================
  // HTML Generation Helpers
  // ============================================================================

  private generateTaxCertificateHtml(cert: TaxCertificateDetailDto): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Tax Certificate - ${cert.tax_year}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    h1 { text-align: center; color: #333; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .section { margin: 20px 0; }
    .section-title { font-weight: bold; background: #f0f0f0; padding: 5px 10px; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    .right { text-align: right; }
    .total { font-weight: bold; background: #f9f9f9; }
    .footer { margin-top: 30px; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${cert.certificate_type} TAX CERTIFICATE</h1>
    <p>Tax Year: ${cert.tax_year}</p>
    ${cert.certificate_number ? `<p>Certificate Number: ${cert.certificate_number}</p>` : ''}
  </div>

  <div class="section">
    <div class="section-title">Employer Details</div>
    <table>
      <tr><td><strong>Employer Name:</strong></td><td>${cert.employer_name}</td></tr>
      ${cert.employer_paye_reference ? `<tr><td><strong>PAYE Reference:</strong></td><td>${cert.employer_paye_reference}</td></tr>` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Employee Details</div>
    <table>
      <tr>
        <td><strong>Name:</strong></td><td>${cert.employee_name}</td>
        <td><strong>Employee #:</strong></td><td>${cert.employee_number}</td>
      </tr>
      <tr>
        <td><strong>ID Number:</strong></td><td>${cert.id_number || '-'}</td>
        <td><strong>Tax Reference:</strong></td><td>${cert.tax_reference || '-'}</td>
      </tr>
      <tr>
        <td><strong>Employment Start:</strong></td><td>${cert.employment_start}</td>
        <td><strong>Periods Worked:</strong></td><td>${cert.periods_worked}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Income</div>
    <table>
      <tr><td>Gross Remuneration</td><td class="right">R ${cert.gross_remuneration.toFixed(2)}</td></tr>
      <tr><td>Less: Non-Taxable Income</td><td class="right">R ${cert.gross_non_taxable.toFixed(2)}</td></tr>
      <tr class="total"><td>Taxable Income</td><td class="right">R ${cert.taxable_income.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Deductions</div>
    <table>
      <tr><td>PAYE Deducted</td><td class="right">R ${cert.paye_deducted.toFixed(2)}</td></tr>
      <tr><td>UIF (Employee)</td><td class="right">R ${cert.uif_employee.toFixed(2)}</td></tr>
      ${cert.pension_fund ? `<tr><td>Pension/Provident Fund</td><td class="right">R ${cert.pension_fund.toFixed(2)}</td></tr>` : ''}
      ${cert.medical_aid ? `<tr><td>Medical Aid</td><td class="right">R ${cert.medical_aid.toFixed(2)}</td></tr>` : ''}
      ${cert.other_deductions ? `<tr><td>Other Deductions</td><td class="right">R ${cert.other_deductions.toFixed(2)}</td></tr>` : ''}
      <tr class="total"><td>Total Deductions</td><td class="right">R ${cert.total_deductions.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Summary</div>
    <table>
      <tr class="total"><td>Total Income</td><td class="right">R ${cert.total_income.toFixed(2)}</td></tr>
      <tr class="total"><td>Total Tax Deducted</td><td class="right">R ${cert.paye_deducted.toFixed(2)}</td></tr>
    </table>
  </div>

  <div class="footer">
    <p>Issue Date: ${cert.issue_date}</p>
    <p>Status: ${cert.status}</p>
    ${cert.submitted_to_sars ? `<p>Submitted to SARS: ${cert.sars_submission_date}</p>` : ''}
    <p>This certificate is issued in terms of the Income Tax Act.</p>
  </div>
</body>
</html>
    `;
  }
}
