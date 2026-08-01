import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Res,
  UseGuards,
  Header,
  Req,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiProduces,
} from '@nestjs/swagger';
import { PayslipService } from './services/payslip.service';
import { BankFileService } from './services/bank-file.service';
import { GLJournalService } from './services/gl-journal.service';
import { PayslipPdfService } from '../../core/payslip/pdf.service';
import {
  GeneratePayslipDto,
  GenerateBankFileDto,
  GenerateGLJournalDto,
  ReportResponseDto,
} from './dto/report.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

@ApiTags('Reports')
@ApiBearerAuth('bearerAuth')
@Controller('payruns/:payrun_id/reports')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ReportsController {
  constructor(
    private readonly payslipService: PayslipService,
    private readonly bankFileService: BankFileService,
    private readonly glJournalService: GLJournalService,
    private readonly payslipPdfService: PayslipPdfService,
  ) { }

  // ============================================================================
  // PAYSLIPS
  // ============================================================================

  @Get('payslips')
  @Permissions('report:payslip:read')
  @ApiOperation({ summary: 'Get payslip data for all employees in payrun' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'Payslip data' })
  async getPayslips(@Param('payrun_id') payrunId: string) {
    const payslips = await this.payslipService.generatePayslipData(payrunId);
    return { items: payslips, count: payslips.length };
  }

  @Get('payslips/:employee_id')
  @Permissions('report:payslip:read')
  @ApiOperation({ summary: 'Get payslip for a specific employee' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiResponse({ status: 200, description: 'Payslip data' })
  async getEmployeePayslip(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
  ) {
    const payslips = await this.payslipService.generatePayslipData(payrunId, [employeeId]);
    if (payslips.length === 0) {
      return { error: 'Employee not found in this payrun' };
    }
    return payslips[0];
  }

  @Get('payslips/:employee_id/text')
  @Permissions('report:payslip:read')
  @ApiOperation({ summary: 'Get payslip as plain text' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiProduces('text/plain')
  @Header('Content-Type', 'text/plain')
  async getEmployeePayslipText(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
    @Res() res: Response,
  ) {
    const payslips = await this.payslipService.generatePayslipData(payrunId, [employeeId]);
    if (payslips.length === 0) {
      return res.status(404).send('Employee not found in this payrun');
    }
    const text = this.payslipService.generatePayslipText(payslips[0]);
    res.type('text/plain').send(text);
  }

  @Get('payslips/:employee_id/html')
  @Permissions('report:payslip:read')
  @ApiOperation({ summary: 'Get payslip as HTML (for PDF rendering)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiProduces('text/html')
  @Header('Content-Type', 'text/html')
  async getEmployeePayslipHtml(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
    @Res() res: Response,
  ) {
    const payslips = await this.payslipService.generatePayslipData(payrunId, [employeeId]);
    if (payslips.length === 0) {
      return res.status(404).send('Employee not found in this payrun');
    }
    const html = this.payslipService.generatePayslipHtml(payslips[0]);
    res.type('text/html').send(html);
  }

  @Get('payslips/:employee_id/pdf')
  @Permissions('report:payslip:read')
  @ApiOperation({ summary: 'Download payslip as PDF' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiParam({ name: 'employee_id', example: 'emp_1' })
  @ApiProduces('application/pdf')
  async getEmployeePayslipPdf(
    @Param('payrun_id') payrunId: string,
    @Param('employee_id') employeeId: string,
    @Res() res: Response,
  ) {
    const payslips = await this.payslipService.generatePayslipData(payrunId, [employeeId]);
    if (payslips.length === 0) {
      return res.status(404).send('Employee not found in this payrun');
    }
    const data = payslips[0];
    // Build a PayslipDetailDto-compatible object for the PDF service
    const pdfInput = {
      id: '',
      employee_id: data.employee.id,
      employee_number: data.employee.employee_no,
      employee_name: data.employee.full_name,
      company_name: data.employer.name,
      company_address: data.employer.address,
      company_registration: data.employer.registration_no,
      period_start: data.pay_period.start,
      period_end: data.pay_period.end,
      pay_date: data.pay_period.payment_date,
      pay_frequency: 'Monthly',
      id_number: data.employee.national_id,
      tax_reference: data.employee.tax_number,
      earnings: data.earnings.map((e: any) => ({ code: '', name: e.description, amount: e.amount })),
      total_earnings: data.totals.gross,
      deductions: data.deductions.map((d: any) => ({ code: '', name: d.description, amount: d.amount, is_statutory: true })),
      total_deductions: data.totals.total_deductions,
      employer_contributions: [],
      total_employer_contributions: 0,
      gross: data.totals.gross,
      paye: data.totals.paye,
      net: data.totals.net,
      ytd_gross: data.totals.gross,
      ytd_paye: data.totals.paye,
      ytd_net: data.totals.net,
      bank_name: data.bank_account?.bank_name,
      branch_code: data.bank_account?.branch_code,
      account_number_masked: data.bank_account?.masked_account,
      currency: 'ZAR',
    } as any;

    const pdfBuffer = await this.payslipPdfService.generate(pdfInput);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${data.employee.employee_no}-${data.pay_period.end}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  }

  // ============================================================================
  // BANK FILE
  // ============================================================================

  @Get('bank-file')
  @Permissions('report:bankfile:read')
  @ApiOperation({ summary: 'Get bank file records (JSON)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'Bank file records' })
  async getBankFileRecords(@Param('payrun_id') payrunId: string, @Req() req: any) {
    const records = await this.bankFileService.generateBankFileRecords(payrunId, req.user?.id || 'system');
    const total = records.reduce((sum, r) => sum + r.amount, 0);
    return {
      items: records,
      count: records.length,
      total_amount: Math.round(total * 100) / 100,
    };
  }

  @Get('bank-file/csv')
  @Permissions('report:bankfile:read')
  @ApiOperation({ summary: 'Download bank file as CSV' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiProduces('text/csv')
  async downloadBankFileCSV(
    @Param('payrun_id') payrunId: string,
    @Res() res: Response,
    @Req() req: any,
  ) {
    const csv = await this.bankFileService.generateCSVBankFile(payrunId, req.user?.id || 'system');
    res
      .type('text/csv')
      .header('Content-Disposition', `attachment; filename="bank_file_${payrunId}.csv"`)
      .send(csv);
  }

  @Post('bank-file/acb')
  @Permissions('report:bankfile:generate')
  @ApiOperation({ summary: 'Generate ACB bank file (South African Bankserv format)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiProduces('text/plain')
  async generateACBFile(
    @Param('payrun_id') payrunId: string,
    @Body() body: {
      user_code: string;
      user_generation_no: number;
      contra_account_branch: string;
      contra_account_number: string;
      contra_account_type: '1' | '2' | '3';
    },
    @Res() res: Response,
    @Req() req: any,
  ) {
    const acb = await this.bankFileService.generateACBFile(payrunId, req.user?.id || 'system', {
      userCode: body.user_code,
      userGenerationNo: body.user_generation_no,
      contraAccountBranch: body.contra_account_branch,
      contraAccountNumber: body.contra_account_number,
      contraAccountType: body.contra_account_type,
    });
    res
      .type('text/plain')
      .header('Content-Disposition', `attachment; filename="salary_${payrunId}.txt"`)
      .send(acb);
  }

  // ============================================================================
  // GL JOURNAL
  // ============================================================================

  @Get('gl-journal')
  @Permissions('report:gljournal:read')
  @ApiOperation({ summary: 'Get GL journal entries (JSON)' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'GL journal entries' })
  async getGLJournal(@Param('payrun_id') payrunId: string) {
    const entries = await this.glJournalService.generateJournalEntries(payrunId);
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
    return {
      items: entries,
      count: entries.length,
      total_debits: Math.round(totalDebits * 100) / 100,
      total_credits: Math.round(totalCredits * 100) / 100,
      balanced: Math.abs(totalDebits - totalCredits) < 0.01,
    };
  }

  @Get('gl-journal/csv')
  @Permissions('report:gljournal:read')
  @ApiOperation({ summary: 'Download GL journal as CSV' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiProduces('text/csv')
  async downloadGLJournalCSV(
    @Param('payrun_id') payrunId: string,
    @Res() res: Response,
  ) {
    const csv = await this.glJournalService.generateCSV(payrunId);
    res
      .type('text/csv')
      .header('Content-Disposition', `attachment; filename="gl_journal_${payrunId}.csv"`)
      .send(csv);
  }

  // ============================================================================
  // SUMMARY
  // ============================================================================

  @Get('summary')
  @Permissions('report:summary:read')
  @ApiOperation({ summary: 'Get payrun summary report' })
  @ApiParam({ name: 'payrun_id', example: 'pr_456' })
  @ApiResponse({ status: 200, description: 'Payrun summary' })
  async getSummary(@Param('payrun_id') payrunId: string) {
    return this.glJournalService.generateSummary(payrunId);
  }
}
