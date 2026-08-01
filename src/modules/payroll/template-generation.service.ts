import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PayrollService } from './payroll.service';

@Injectable()
export class TemplateGenerationService {
  constructor(private readonly payrollService: PayrollService) {}

  async generateSupplementalTemplate(): Promise<Buffer> {
    const refData = await this.payrollService.getReferenceData();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hubsec Workforce Platform';
    workbook.created = new Date();

    // --- README Sheet ---
    const readmeSheet = workbook.addWorksheet('README');
    readmeSheet.getColumn(1).width = 100;
    readmeSheet.addRow(['PAYROLL SUPPLEMENTAL IMPORT TEMPLATE']);
    readmeSheet.addRow(['']);
    readmeSheet.addRow(['This workbook configures the ongoing payroll rules and baseline data for each employee.']);
    readmeSheet.addRow(['It requires four distinct sheets in the following order:']);
    readmeSheet.addRow(['1. compensation - Base salaries, hourly rates, and core earnings.']);
    readmeSheet.addRow(['2. bankaccounts - Employee direct deposit information.']);
    readmeSheet.addRow(['3. recurringdeductions - Ongoing deductions (medical aid, union fees, etc.).']);
    readmeSheet.addRow(['4. payrolleligibility - Defines which pay group the employee belongs to and their active status.']);
    readmeSheet.addRow(['']);
    readmeSheet.addRow(['Please use the dropdowns provided to ensure data validation.']);
    
    // Make README nice
    readmeSheet.getCell('A1').font = { bold: true, size: 14 };

    // --- HIDDEN REFERENCE VALUES SHEET ---
    const refSheet = workbook.addWorksheet('__reference_values', { state: 'hidden' });
    
    // We will put arrays in columns:
    // A: payGroups
    // B: payItems (all)
    // C: deductionCodes
    // D: earningComponentCodes
    // E: payrollStatuses
    // F: frequencies
    // G: currencies
    // H: verified (Yes/No)

    const maxRows = Math.max(
      refData.payGroups.length,
      refData.payItems.length,
      refData.deductionCodes.length,
      refData.earningComponentCodes.length,
      refData.payrollStatuses.length,
      refData.frequencies.length,
      refData.currencies.length,
      2 // Yes/No
    );

    refSheet.addRow(['payGroups', 'payItems', 'deductionCodes', 'earningComponentCodes', 'payrollStatuses', 'frequencies', 'currencies', 'verified']);
    
    for (let i = 0; i < maxRows; i++) {
      refSheet.addRow([
        refData.payGroups[i] || '',
        refData.payItems[i] || '',
        refData.deductionCodes[i] || '',
        refData.earningComponentCodes[i] || '',
        refData.payrollStatuses[i] || '',
        refData.frequencies[i] || '',
        refData.currencies[i] || '',
        ['true', 'false'][i] || ''
      ]);
    }

    // --- COMPENSATION SHEET ---
    const compSheet = workbook.addWorksheet('compensation');
    compSheet.columns = [
      { header: 'employee_no', key: 'employee_no', width: 20 },
      { header: 'effective_from', key: 'effective_from', width: 15 },
      { header: 'component_code', key: 'component_code', width: 20 },
      { header: 'component_type', key: 'component_type', width: 15 },
      { header: 'amount', key: 'amount', width: 15 },
      { header: 'frequency', key: 'frequency', width: 15 },
      { header: 'currency', key: 'currency', width: 10 },
    ];
    
    // Data validation up to 1000 rows
    for (let i = 2; i <= 1000; i++) {
      compSheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$D$2:$D$${refData.earningComponentCodes.length + 1}`]
      };
      compSheet.getCell(`F${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$F$2:$F$${refData.frequencies.length + 1}`]
      };
      compSheet.getCell(`G${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$G$2:$G$${refData.currencies.length + 1}`]
      };
    }

    // --- BANK ACCOUNTS SHEET ---
    const bankSheet = workbook.addWorksheet('bankaccounts');
    bankSheet.columns = [
      { header: 'employee_no', key: 'employee_no', width: 20 },
      { header: 'bank_name', key: 'bank_name', width: 25 },
      { header: 'account_number', key: 'account_number', width: 20 },
      { header: 'account_type', key: 'account_type', width: 15 },
      { header: 'verified', key: 'verified', width: 10 },
    ];

    for (let i = 2; i <= 1000; i++) {
      bankSheet.getCell(`E${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$H$2:$H$3`] // true/false
      };
    }

    // --- RECURRING DEDUCTIONS SHEET ---
    const dedSheet = workbook.addWorksheet('recurringdeductions');
    dedSheet.columns = [
      { header: 'employee_no', key: 'employee_no', width: 20 },
      { header: 'deduction_code', key: 'deduction_code', width: 25 },
      { header: 'amount', key: 'amount', width: 15 },
      { header: 'frequency', key: 'frequency', width: 15 },
      { header: 'effective_from', key: 'effective_from', width: 15 },
    ];

    for (let i = 2; i <= 1000; i++) {
      dedSheet.getCell(`B${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$C$2:$C$${refData.deductionCodes.length + 1}`]
      };
      dedSheet.getCell(`D${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$F$2:$F$${refData.frequencies.length + 1}`]
      };
    }

    // --- PAYROLL ELIGIBILITY SHEET ---
    const elSheet = workbook.addWorksheet('payrolleligibility');
    elSheet.columns = [
      { header: 'employee_no', key: 'employee_no', width: 20 },
      { header: 'pay_group_code', key: 'pay_group_code', width: 20 },
      { header: 'payroll_status', key: 'payroll_status', width: 15 },
      { header: 'effective_from', key: 'effective_from', width: 15 },
    ];

    for (let i = 2; i <= 1000; i++) {
      elSheet.getCell(`B${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$A$2:$A$${refData.payGroups.length + 1}`]
      };
      elSheet.getCell(`C${i}`).dataValidation = {
        type: 'list',
        allowBlank: true,
        formulae: [`=__reference_values!$E$2:$E$${refData.payrollStatuses.length + 1}`]
      };
    }

    // --- Style Header Rows ---
    [compSheet, bankSheet, dedSheet, elSheet].forEach(sheet => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' }
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /** Tenant-facing opening balances workbook (structure matches import validation). */
  async generateOpeningBalancesTemplate(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hubsec Workforce Platform';
    workbook.created = new Date();

    const readme = workbook.addWorksheet('README');
    readme.getColumn(1).width = 100;
    readme.addRow(['OPENING BALANCES IMPORT TEMPLATE']);
    readme.addRow(['']);
    readme.addRow(['Required tab: payrollopeningbalances (lowercase). Optional: leavebalances, loanbalances.']);
    readme.addRow(['Set tax_year per row or rely on import context; amounts are YTD figures from the prior system.']);
    readme.getCell('A1').font = { bold: true, size: 14 };

    const bal = workbook.addWorksheet('payrollopeningbalances');
    bal.columns = [
      { header: 'employee_no', key: 'employee_no', width: 18 },
      { header: 'tax_year', key: 'tax_year', width: 10 },
      { header: 'ytd_gross', key: 'ytd_gross', width: 14 },
      { header: 'ytd_taxable', key: 'ytd_taxable', width: 14 },
      { header: 'ytd_paye', key: 'ytd_paye', width: 14 },
      { header: 'ytd_net', key: 'ytd_net', width: 14 },
      { header: 'ytd_uif_employee', key: 'ytd_uif_employee', width: 16 },
      { header: 'ytd_uif_employer', key: 'ytd_uif_employer', width: 16 },
      { header: 'ytd_sdl', key: 'ytd_sdl', width: 12 },
      { header: 'ytd_employer_cost', key: 'ytd_employer_cost', width: 16 },
    ];

    const leave = workbook.addWorksheet('leavebalances');
    leave.columns = [
      { header: 'employee_no', key: 'employee_no', width: 18 },
      { header: 'leave_type', key: 'leave_type', width: 14 },
      { header: 'balance', key: 'balance', width: 12 },
      { header: 'as_of_date', key: 'as_of_date', width: 14 },
      { header: 'unit', key: 'unit', width: 10 },
    ];

    const loan = workbook.addWorksheet('loanbalances');
    loan.columns = [
      { header: 'employee_no', key: 'employee_no', width: 18 },
      { header: 'deduction_code', key: 'deduction_code', width: 18 },
      { header: 'remaining_balance', key: 'remaining_balance', width: 16 },
      { header: 'installment_amount', key: 'installment_amount', width: 16 },
      { header: 'original_balance', key: 'original_balance', width: 16 },
      { header: 'as_of_date', key: 'as_of_date', width: 14 },
      { header: 'reference_no', key: 'reference_no', width: 16 },
    ];

    [bal, leave, loan].forEach((sheet) => {
      sheet.getRow(1).font = { bold: true };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFEEEEEE' },
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
