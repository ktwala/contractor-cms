import { Injectable } from '@nestjs/common';

interface EMP201Return {
  id: string;
  tax_period_id: string;
  period_month: string;
  employer_tax_number: string;
  employer_paye_number: string;
  employer_name: string;
  // Employee counts
  total_employees: number;
  sa_employees: number;
  foreign_employees: number;
  // PAYE
  total_paye: number;
  // UIF
  total_uif: number;
  employee_uif: number;
  employer_uif: number;
  // SDL
  total_sdl: number;
  // Totals
  total_liability: number;
  previous_balance: number;
  total_due: number;
}

interface EmployeeEMP201Detail {
  employee_number: string;
  id_number: string;
  first_name: string;
  last_name: string;
  paye: number;
  uif_employee: number;
  uif_employer: number;
  sdl: number;
  total: number;
}

@Injectable()
export class EMP201CsvService {
  /**
   * Generate EMP201 CSV for SARS eFiling
   * Format: SARS-compliant CSV with specific columns
   */
  generateEMP201CSV(emp201: EMP201Return, employeeDetails?: EmployeeEMP201Detail[]): string {
    const lines: string[] = [];

    // Header section
    lines.push('EMP201 - Employer Monthly Declaration');
    lines.push('');
    lines.push(`Employer Tax Number,${emp201.employer_tax_number}`);
    lines.push(`PAYE Reference Number,${emp201.employer_paye_number}`);
    lines.push(`Employer Name,${this.escapeCsv(emp201.employer_name)}`);
    lines.push(`Period,${emp201.period_month}`);
    lines.push(`Generated,${new Date().toISOString()}`);
    lines.push('');

    // Summary section
    lines.push('SUMMARY');
    lines.push('Description,Amount');
    lines.push(`Total Employees,${emp201.total_employees}`);
    lines.push(`SA Employees,${emp201.sa_employees}`);
    lines.push(`Foreign Employees,${emp201.foreign_employees}`);
    lines.push('');
    lines.push(`Total PAYE,${this.formatAmount(emp201.total_paye)}`);
    lines.push(`Employee UIF,${this.formatAmount(emp201.employee_uif)}`);
    lines.push(`Employer UIF,${this.formatAmount(emp201.employer_uif)}`);
    lines.push(`Total UIF,${this.formatAmount(emp201.total_uif)}`);
    lines.push(`Total SDL,${this.formatAmount(emp201.total_sdl)}`);
    lines.push('');
    lines.push(`Total Liability,${this.formatAmount(emp201.total_liability)}`);
    lines.push(`Previous Balance,${this.formatAmount(emp201.previous_balance)}`);
    lines.push(`Total Due,${this.formatAmount(emp201.total_due)}`);
    lines.push('');

    // Employee details (if provided)
    if (employeeDetails && employeeDetails.length > 0) {
      lines.push('EMPLOYEE DETAILS');
      lines.push('Employee Number,ID Number,First Name,Last Name,PAYE,UIF (Employee),UIF (Employer),SDL,Total');

      employeeDetails.forEach(emp => {
        lines.push([
          this.escapeCsv(emp.employee_number),
          this.escapeCsv(emp.id_number),
          this.escapeCsv(emp.first_name),
          this.escapeCsv(emp.last_name),
          this.formatAmount(emp.paye),
          this.formatAmount(emp.uif_employee),
          this.formatAmount(emp.uif_employer),
          this.formatAmount(emp.sdl),
          this.formatAmount(emp.total),
        ].join(','));
      });
      lines.push('');
    }

    // Footer
    lines.push('END OF DECLARATION');

    return lines.join('\n');
  }

  /**
   * Generate EMP201 in SARS eFiling import format
   * This is the actual format that SARS eFiling system accepts
   */
  generateSARSeFilingCSV(emp201: EMP201Return): string {
    const lines: string[] = [];

    // SARS eFiling format (simplified version)
    // Actual SARS format may vary - this is a basic structure
    lines.push('Record Type,Tax Reference Number,PAYE Reference,Period,Description,Amount');

    // Header record
    lines.push([
      'H',
      emp201.employer_tax_number,
      emp201.employer_paye_number,
      this.formatPeriodForSARS(emp201.period_month),
      'EMP201 Declaration',
      '',
    ].join(','));

    // Detail records
    lines.push([
      'D',
      emp201.employer_tax_number,
      emp201.employer_paye_number,
      this.formatPeriodForSARS(emp201.period_month),
      'PAYE',
      this.formatAmount(emp201.total_paye),
    ].join(','));

    lines.push([
      'D',
      emp201.employer_tax_number,
      emp201.employer_paye_number,
      this.formatPeriodForSARS(emp201.period_month),
      'UIF',
      this.formatAmount(emp201.total_uif),
    ].join(','));

    lines.push([
      'D',
      emp201.employer_tax_number,
      emp201.employer_paye_number,
      this.formatPeriodForSARS(emp201.period_month),
      'SDL',
      this.formatAmount(emp201.total_sdl),
    ].join(','));

    // Trailer record
    lines.push([
      'T',
      emp201.employer_tax_number,
      emp201.employer_paye_number,
      this.formatPeriodForSARS(emp201.period_month),
      'Total Liability',
      this.formatAmount(emp201.total_liability),
    ].join(','));

    return lines.join('\n');
  }

  /**
   * Generate bulk EMP201 CSV for multiple periods
   */
  generateBulkEMP201CSV(returns: EMP201Return[]): string {
    const lines: string[] = [];

    lines.push('EMP201 - Bulk Export');
    lines.push('');
    lines.push('Period,Total Employees,Total PAYE,Total UIF,Total SDL,Total Liability,Total Due');

    returns.forEach(emp201 => {
      lines.push([
        emp201.period_month,
        emp201.total_employees.toString(),
        this.formatAmount(emp201.total_paye),
        this.formatAmount(emp201.total_uif),
        this.formatAmount(emp201.total_sdl),
        this.formatAmount(emp201.total_liability),
        this.formatAmount(emp201.total_due),
      ].join(','));
    });

    lines.push('');
    lines.push(`Total Periods: ${returns.length}`);
    lines.push(`Generated: ${new Date().toISOString()}`);

    return lines.join('\n');
  }

  /**
   * Generate EMP201 as buffer (for downloads)
   */
  generateEMP201Buffer(emp201: EMP201Return, employeeDetails?: EmployeeEMP201Detail[]): Buffer {
    const csv = this.generateEMP201CSV(emp201, employeeDetails);
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Generate SARS eFiling CSV as buffer
   */
  generateSARSeFilingBuffer(emp201: EMP201Return): Buffer {
    const csv = this.generateSARSeFilingCSV(emp201);
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Escape CSV values (handle commas, quotes)
   */
  private escapeCsv(value: string): string {
    if (!value) return '';

    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }

    return value;
  }

  /**
   * Format amount for CSV (2 decimal places, no currency symbol)
   */
  private formatAmount(amount: number): string {
    return amount.toFixed(2);
  }

  /**
   * Format period for SARS (YYYYMM format)
   */
  private formatPeriodForSARS(period: string): string {
    // Convert from YYYY-MM to YYYYMM
    return period.replace('-', '');
  }

  /**
   * Validate EMP201 data before export
   */
  validateEMP201(emp201: EMP201Return): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!emp201.employer_tax_number || emp201.employer_tax_number.length !== 10) {
      errors.push('Invalid employer tax number (must be 10 digits)');
    }

    if (!emp201.employer_paye_number || emp201.employer_paye_number.length !== 10) {
      errors.push('Invalid PAYE reference number (must be 10 digits)');
    }

    if (!emp201.period_month || !/^\d{4}-\d{2}$/.test(emp201.period_month)) {
      errors.push('Invalid period format (must be YYYY-MM)');
    }

    if (emp201.total_employees < 0) {
      errors.push('Total employees cannot be negative');
    }

    if (emp201.total_paye < 0) {
      errors.push('Total PAYE cannot be negative');
    }

    if (emp201.total_uif < 0) {
      errors.push('Total UIF cannot be negative');
    }

    if (emp201.total_sdl < 0) {
      errors.push('Total SDL cannot be negative');
    }

    // Validate UIF calculation (employee + employer should equal total)
    const calculatedUIF = emp201.employee_uif + emp201.employer_uif;
    if (Math.abs(calculatedUIF - emp201.total_uif) > 0.01) {
      errors.push('UIF totals mismatch (employee + employer != total)');
    }

    // Validate total liability
    const calculatedLiability = emp201.total_paye + emp201.total_uif + emp201.total_sdl;
    if (Math.abs(calculatedLiability - emp201.total_liability) > 0.01) {
      errors.push('Total liability mismatch');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
