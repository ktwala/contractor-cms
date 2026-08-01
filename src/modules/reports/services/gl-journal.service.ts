import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';
import { format } from 'date-fns';
import { GLJournalEntry, PayrunSummaryReport } from '../dto/report.dto';

/**
 * Default GL account mapping for payroll entries
 * Override via pay item glAccount field or API parameter
 */
const DEFAULT_GL_MAPPING: Record<string, { code: string; name: string }> = {
  // Earnings (Expenses - Debit)
  BASIC: { code: '5100', name: 'Salaries & Wages' },
  OVERTIME: { code: '5110', name: 'Overtime Pay' },
  COMMISSION: { code: '5120', name: 'Commission Expense' },
  BONUS: { code: '5130', name: 'Bonus Expense' },
  ALLOWANCE: { code: '5140', name: 'Allowances' },
  TRAVEL: { code: '5150', name: 'Travel Allowance' },

  // Statutory Deductions (Liabilities - Credit)
  PAYE: { code: '2200', name: 'PAYE Payable' },
  UIF_EE: { code: '2210', name: 'UIF Employee Payable' },
  UIF_ER: { code: '5200', name: 'UIF Employer Expense' },
  SDL: { code: '2220', name: 'SDL Payable' },

  // Other Deductions (Liabilities - Credit)
  PENSION_EE: { code: '2230', name: 'Pension Deductions Payable' },
  PENSION_ER: { code: '5210', name: 'Pension Employer Contribution' },
  MEDICAL_EE: { code: '2240', name: 'Medical Aid Deductions Payable' },
  MEDICAL_ER: { code: '5220', name: 'Medical Aid Employer Contribution' },

  // Net Pay (Liability - Credit)
  NET_PAY: { code: '2100', name: 'Net Salaries Payable' },

  // Control Account
  PAYROLL_CONTROL: { code: '2000', name: 'Payroll Control' },
};

@Injectable()
export class GLJournalService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate GL journal entries for a payrun
   */
  async generateJournalEntries(
    payrunId: string,
    glMapping?: Record<string, string>,
  ): Promise<GLJournalEntry[]> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { include: { legalEntity: true } },
        period: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    // Get all pay lines grouped by pay item
    const payLines = await this.prisma.payLine.findMany({
      where: {
        employeeResult: { payrunId },
      },
      include: {
        payItem: true,
        employeeResult: {
          include: {
            employee: {
              include: {
                employments: {
                  where: { effectiveTo: null },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Aggregate by pay item and cost center
    const aggregates: Map<string, {
      payItem: any;
      amount: number;
      costCenters: Map<string, number>;
    }> = new Map();

    for (const line of payLines) {
      const key = line.payItem.code;
      const costCenter = line.employeeResult.employee.employments[0]?.costCenter || 'DEFAULT';

      if (!aggregates.has(key)) {
        aggregates.set(key, {
          payItem: line.payItem,
          amount: 0,
          costCenters: new Map(),
        });
      }

      const agg = aggregates.get(key)!;
      agg.amount += Number(line.amount);
      agg.costCenters.set(
        costCenter,
        (agg.costCenters.get(costCenter) || 0) + Number(line.amount),
      );
    }

    // Get total net pay
    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
    });
    const totalNet = results.reduce((sum, r) => sum + Number(r.net), 0);
    const totalGross = results.reduce((sum, r) => sum + Number(r.gross), 0);
    const totalDeductions = results.reduce((sum, r) => sum + Number(r.deductionsTotal), 0);

    const entries: GLJournalEntry[] = [];
    const reference = `PR-${payrun.period ? format(payrun.period.endDate, 'yyyyMM') : format(payrun.periodEnd || new Date(), 'yyyyMM')}-${payrunId.slice(-6)}`;

    // Process each pay item
    for (const [code, agg] of aggregates) {
      const payItem = agg.payItem;
      const mapping = this.getGLMapping(code, payItem.glAccount, glMapping);

      // Determine if this is a debit or credit based on pay item type
      const isExpense = ['EARNING', 'ALLOWANCE', 'BONUS'].includes(payItem.type);
      const isEmployerContribution = code.endsWith('_ER');

      if (isExpense || isEmployerContribution) {
        // Expenses are debits
        entries.push({
          account_code: mapping.code,
          account_name: mapping.name,
          debit: Math.round(agg.amount * 100) / 100,
          credit: 0,
          reference,
          description: `${payItem.name} - ${payrun.period ? payrun.period.startDate.toISOString().slice(0, 7) : (payrun.periodStart || new Date()).toISOString().slice(0, 7)}`,
        });
      } else {
        // Deductions are credits (liabilities)
        entries.push({
          account_code: mapping.code,
          account_name: mapping.name,
          debit: 0,
          credit: Math.round(agg.amount * 100) / 100,
          reference,
          description: `${payItem.name} - ${payrun.period ? payrun.period.startDate.toISOString().slice(0, 7) : (payrun.periodStart || new Date()).toISOString().slice(0, 7)}`,
        });
      }
    }

    // Net pay entry (Credit to Net Salaries Payable)
    const netPayMapping = this.getGLMapping('NET_PAY', null, glMapping);
    entries.push({
      account_code: netPayMapping.code,
      account_name: netPayMapping.name,
      debit: 0,
      credit: Math.round(totalNet * 100) / 100,
      reference,
      description: `Net Salaries Payable - ${payrun.period ? payrun.period.startDate.toISOString().slice(0, 7) : (payrun.periodStart || new Date()).toISOString().slice(0, 7)}`,
    });

    // Verify balanced (debits = credits)
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);

    // If not balanced, add adjustment to control account
    const diff = Math.round((totalDebits - totalCredits) * 100) / 100;
    if (Math.abs(diff) > 0.01) {
      const controlMapping = this.getGLMapping('PAYROLL_CONTROL', null, glMapping);
      entries.push({
        account_code: controlMapping.code,
        account_name: controlMapping.name,
        debit: diff < 0 ? Math.abs(diff) : 0,
        credit: diff > 0 ? diff : 0,
        reference,
        description: 'Payroll Control Adjustment',
      });
    }

    return entries;
  }

  /**
   * Generate GL journal as CSV
   */
  async generateCSV(payrunId: string, glMapping?: Record<string, string>): Promise<string> {
    const entries = await this.generateJournalEntries(payrunId, glMapping);

    const lines: string[] = [];
    lines.push('Account Code,Account Name,Debit,Credit,Reference,Description,Cost Center');

    for (const entry of entries) {
      lines.push([
        entry.account_code,
        `"${entry.account_name}"`,
        entry.debit.toFixed(2),
        entry.credit.toFixed(2),
        entry.reference,
        `"${entry.description}"`,
        entry.cost_center || '',
      ].join(','));
    }

    // Add totals row
    const totalDebits = entries.reduce((sum, e) => sum + e.debit, 0);
    const totalCredits = entries.reduce((sum, e) => sum + e.credit, 0);
    lines.push('');
    lines.push(`TOTALS,,${totalDebits.toFixed(2)},${totalCredits.toFixed(2)},,`);

    return lines.join('\n');
  }

  /**
   * Generate payrun summary report
   */
  async generateSummary(payrunId: string): Promise<PayrunSummaryReport> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: true,
        period: true,
      },
    });

    if (!payrun) {
      throw new NotFoundException(`PayRun ${payrunId} not found`);
    }

    const results = await this.prisma.employeeResult.findMany({
      where: { payrunId },
      include: {
        payLines: { include: { payItem: true } },
        employee: {
          include: {
            employments: {
              where: { effectiveTo: null },
              take: 1,
            },
          },
        },
      },
    });

    // Aggregate totals
    let totalGross = 0;
    let totalTaxableIncome = 0;
    let totalPaye = 0;
    let totalDeductions = 0;
    let totalNet = 0;
    let totalUifEmployee = 0;
    let totalUifEmployer = 0;

    // By pay item
    const byPayItem: Map<string, {
      code: string;
      name: string;
      type: string;
      total: number;
      count: number;
    }> = new Map();

    // By department (cost center)
    const byDepartment: Map<string, {
      headcount: number;
      gross: number;
      net: number;
    }> = new Map();

    for (const result of results) {
      totalGross += Number(result.gross);
      totalTaxableIncome += Number(result.taxableIncome);
      totalPaye += Number(result.paye);
      totalDeductions += Number(result.deductionsTotal);
      totalNet += Number(result.net);

      const dept = result.employee.employments[0]?.costCenter || 'Unassigned';
      if (!byDepartment.has(dept)) {
        byDepartment.set(dept, { headcount: 0, gross: 0, net: 0 });
      }
      const deptAgg = byDepartment.get(dept)!;
      deptAgg.headcount++;
      deptAgg.gross += Number(result.gross);
      deptAgg.net += Number(result.net);

      for (const line of result.payLines) {
        const key = line.payItem.code;
        if (!byPayItem.has(key)) {
          byPayItem.set(key, {
            code: line.payItem.code,
            name: line.payItem.name,
            type: line.payItem.type,
            total: 0,
            count: 0,
          });
        }
        const itemAgg = byPayItem.get(key)!;
        itemAgg.total += Number(line.amount);
        itemAgg.count++;

        if (line.payItem.code === 'UIF_EE') {
          totalUifEmployee += Number(line.amount);
        }
        if (line.payItem.code === 'UIF_ER') {
          totalUifEmployer += Number(line.amount);
        }
      }
    }

    return {
      payrun: {
        id: payrun.id,
        name: `PayRun ${payrun.id}`,
        status: payrun.status,
        pay_period: {
          start: payrun.period ? format(payrun.period.startDate, 'yyyy-MM-dd') : format(payrun.periodStart || new Date(), 'yyyy-MM-dd'),
          end: payrun.period ? format(payrun.period.endDate, 'yyyy-MM-dd') : format(payrun.periodEnd || new Date(), 'yyyy-MM-dd'),
        },
      },
      headcount: results.length,
      totals: {
        gross: Math.round(totalGross * 100) / 100,
        taxable_income: Math.round(totalTaxableIncome * 100) / 100,
        paye: Math.round(totalPaye * 100) / 100,
        uif_employee: Math.round(totalUifEmployee * 100) / 100,
        uif_employer: Math.round(totalUifEmployer * 100) / 100,
        total_deductions: Math.round(totalDeductions * 100) / 100,
        net: Math.round(totalNet * 100) / 100,
        employer_cost: Math.round((totalGross + totalUifEmployer) * 100) / 100,
      },
      by_department: Array.from(byDepartment.entries()).map(([dept, agg]) => ({
        department: dept,
        headcount: agg.headcount,
        gross: Math.round(agg.gross * 100) / 100,
        net: Math.round(agg.net * 100) / 100,
      })),
      by_pay_item: Array.from(byPayItem.values())
        .map((item) => ({
          ...item,
          total: Math.round(item.total * 100) / 100,
        }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    };
  }

  private getGLMapping(
    code: string,
    payItemGlAccount: string | null | undefined,
    customMapping?: Record<string, string>,
  ): { code: string; name: string } {
    // Priority: custom mapping > pay item GL account > default mapping
    if (customMapping?.[code]) {
      return { code: customMapping[code], name: code };
    }

    if (payItemGlAccount) {
      return { code: payItemGlAccount, name: code };
    }

    return DEFAULT_GL_MAPPING[code] || { code: '9999', name: `Unknown: ${code}` };
  }
}
