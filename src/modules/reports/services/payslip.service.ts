import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../core/database/prisma.service';
import { PayslipTemplateService } from '../../../core/payslip/payslip-template.service';
import { format } from 'date-fns';
import { PayslipData } from '../dto/report.dto';

@Injectable()
export class PayslipService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payslipTemplateService: PayslipTemplateService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Generate payslip data for one or more employees in a payrun
   */
  async generatePayslipData(
    payrunId: string,
    employeeIds?: string[],
  ): Promise<PayslipData[]> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: {
          include: {
            legalEntity: true,
          },
        },
        period: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    // Get employee results with pay lines
    const whereClause: any = { payrunId };
    if (employeeIds?.length) {
      whereClause.employeeId = { in: employeeIds };
    }

    const results = await this.prisma.employeeResult.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            bankAccounts: {
              where: { effectiveTo: null },
              take: 1,
              orderBy: { effectiveFrom: 'desc' },
            },
            taxProfiles: {
              where: { effectiveTo: null },
              take: 1,
              orderBy: { effectiveFrom: 'desc' },
            },
          },
        },
        payLines: {
          include: {
            payItem: true,
          },
          orderBy: { payItem: { sortOrder: 'asc' } },
        },
      },
    });

    const payslips: PayslipData[] = [];

    for (const result of results) {
      const employee = result.employee;
      const bankAccount = employee.bankAccounts[0];
      const taxProfile = employee.taxProfiles[0];

      // Separate earnings and deductions
      const earnings = result.payLines
        .filter((pl) => pl.type === 'EARNING')
        .map((pl) => ({
          description: pl.payItem.name,
          amount: Number(pl.amount),
        }));

      const deductionLines = result.payLines
        .filter((pl) => ['DEDUCTION', 'TAX'].includes(pl.type))
        .map((pl) => ({
          description: pl.payItem.name,
          amount: Number(pl.amount),
        }));

      const payeLine = result.payLines.find((pl) => pl.payItem.code === 'PAYE');
      const paye = payeLine ? Number(payeLine.amount) : Number(result.paye);

      const payslip: PayslipData = {
        employee: {
          id: employee.id,
          employee_no: employee.employeeNo,
          full_name: `${employee.firstName} ${employee.lastName}`,
          national_id: employee.nationalId || undefined,
          tax_number: taxProfile?.tin || undefined,
        },
        employer: {
          name: payrun.payGroup.legalEntity.name,
          registration_no: payrun.payGroup.legalEntity.registrationNo || undefined,
          address: this.formatLegalEntityAddress(payrun.payGroup.legalEntity.address),
        },
        pay_period: {
          start: payrun.period ? format(payrun.period.startDate, 'yyyy-MM-dd') : format(payrun.periodStart || new Date(), 'yyyy-MM-dd'),
          end: payrun.period ? format(payrun.period.endDate, 'yyyy-MM-dd') : format(payrun.periodEnd || new Date(), 'yyyy-MM-dd'),
          payment_date: payrun.period?.payDate
            ? format(payrun.period.payDate, 'yyyy-MM-dd')
            : (payrun.period ? format(payrun.period.endDate, 'yyyy-MM-dd') : format(payrun.periodEnd || new Date(), 'yyyy-MM-dd')),
        },
        earnings,
        deductions: deductionLines,
        totals: {
          gross: Number(result.gross),
          total_deductions: Number(result.deductionsTotal),
          net: Number(result.net),
          taxable_income: Number(result.taxableIncome),
          paye,
        },
        bank_account: bankAccount
          ? {
              bank_name: bankAccount.bankName,
              branch_code: bankAccount.branchCode || undefined,
              masked_account: bankAccount.maskedAccountNumber,
            }
          : undefined,
      };

      payslips.push(payslip);
    }

    return payslips;
  }

  /**
   * Generate payslip as plain text (for simple output)
   */
  generatePayslipText(payslip: PayslipData): string {
    const lines: string[] = [];
    const width = 60;
    const divider = '='.repeat(width);
    const thinDivider = '-'.repeat(width);

    lines.push(divider);
    lines.push(this.center('PAYSLIP', width));
    lines.push(divider);
    lines.push('');

    // Employer
    lines.push(`Employer: ${payslip.employer.name}`);
    if (payslip.employer.registration_no) {
      lines.push(`Reg No:   ${payslip.employer.registration_no}`);
    }
    lines.push('');

    // Employee
    lines.push(`Employee: ${payslip.employee.full_name}`);
    lines.push(`Emp No:   ${payslip.employee.employee_no}`);
    if (payslip.employee.tax_number) {
      lines.push(`Tax No:   ${payslip.employee.tax_number}`);
    }
    lines.push('');

    // Pay Period
    lines.push(`Pay Period: ${payslip.pay_period.start} to ${payslip.pay_period.end}`);
    lines.push(`Payment Date: ${payslip.pay_period.payment_date}`);
    lines.push('');

    // Earnings
    lines.push(thinDivider);
    lines.push('EARNINGS');
    lines.push(thinDivider);
    for (const earning of payslip.earnings) {
      lines.push(this.formatLine(earning.description, earning.amount, width));
    }
    lines.push(thinDivider);
    lines.push(this.formatLine('GROSS PAY', payslip.totals.gross, width, true));
    lines.push('');

    // Deductions
    lines.push(thinDivider);
    lines.push('DEDUCTIONS');
    lines.push(thinDivider);
    for (const deduction of payslip.deductions) {
      lines.push(this.formatLine(deduction.description, deduction.amount, width));
    }
    lines.push(thinDivider);
    lines.push(this.formatLine('TOTAL DEDUCTIONS', payslip.totals.total_deductions, width, true));
    lines.push('');

    // Net Pay
    lines.push(divider);
    lines.push(this.formatLine('NET PAY', payslip.totals.net, width, true));
    lines.push(divider);
    lines.push('');

    // Bank Details
    if (payslip.bank_account) {
      lines.push(`Bank: ${payslip.bank_account.bank_name}`);
      lines.push(`Account: ${payslip.bank_account.masked_account}`);
    }

    return lines.join('\n');
  }

  /**
   * Generate payslip as HTML using shared Schedule of Remuneration template
   */
  generatePayslipHtml(payslip: PayslipData): string {
    const currency = 'ZAR'; // Reports module typically uses ZAR; could be passed from payrun context
    const periodLabel = payslip.pay_period.end
      ? new Date(payslip.pay_period.end + 'T12:00:00').toLocaleDateString('en-GB', {
          month: 'long',
          year: 'numeric',
        })
      : `${payslip.pay_period.start} - ${payslip.pay_period.end}`;

    const input = {
      company_name: payslip.employer.name,
      company_address: payslip.employer.address,
      employee_name: payslip.employee.full_name,
      employee_number: payslip.employee.employee_no,
      job_title: undefined,
      date_engaged: undefined,
      id_number: payslip.employee.national_id,
      date_of_birth: undefined,
      tax_reference: payslip.employee.tax_number,
      address: undefined,
      bank_name: payslip.bank_account?.bank_name,
      branch: undefined,
      branch_code: payslip.bank_account?.branch_code,
      account_number: payslip.bank_account?.masked_account,
      pay_method: 'EFT',
      pay_date: payslip.pay_period.payment_date.replace(/-/g, '/'),
      payrun_period_start: payslip.pay_period.start.replace(/-/g, '/'),
      payrun_period_end: payslip.pay_period.end.replace(/-/g, '/'),
      working_hours_per_week: '40.00',
      annual_salary_package: payslip.pay_period ? (payslip.totals.gross * 12).toFixed(2) : undefined,
      earnings: payslip.earnings,
      deductions: payslip.deductions,
      gross: payslip.totals.gross,
      total_deductions: payslip.totals.total_deductions,
      net: payslip.totals.net,
      currency,
      period_label: periodLabel,
      logo_url: this.configService.get<string>('payslip.logoUrl') || undefined,
    };

    return this.payslipTemplateService.render(input);
  }

  private center(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  private formatLine(label: string, amount: number, width: number, bold = false): string {
    const amountStr = this.formatCurrency(amount);
    const spaces = Math.max(1, width - label.length - amountStr.length);
    const line = label + ' '.repeat(spaces) + amountStr;
    return bold ? line.toUpperCase() : line;
  }

  private formatLegalEntityAddress(addr: unknown): string | undefined {
    if (!addr) return undefined;
    if (typeof addr === 'string') return addr;
    if (typeof addr === 'object' && addr !== null) {
      return Object.values(addr as Record<string, unknown>).filter(Boolean).join(', ');
    }
    return undefined;
  }

  private formatCurrency(amount: number): string {
    return 'R ' + amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
}
