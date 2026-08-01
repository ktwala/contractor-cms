import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsArray } from 'class-validator';

export enum ReportType {
  PAYSLIP = 'PAYSLIP',
  PAYSLIP_BATCH = 'PAYSLIP_BATCH',
  BANK_FILE = 'BANK_FILE',
  GL_JOURNAL = 'GL_JOURNAL',
  SUMMARY = 'SUMMARY',
}

export enum ReportFormat {
  PDF = 'PDF',
  CSV = 'CSV',
  JSON = 'JSON',
  TXT = 'TXT',
}

export class GeneratePayslipDto {
  @ApiPropertyOptional({ type: [String], description: 'Specific employee IDs (omit for all)' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  employee_ids?: string[];

  @ApiPropertyOptional({ enum: ReportFormat, default: 'PDF' })
  @IsOptional()
  @IsEnum(ReportFormat)
  format?: ReportFormat;
}

export class GenerateBankFileDto {
  @ApiPropertyOptional({
    enum: ['ACB', 'NACHA', 'SEPA'],
    default: 'ACB',
    description: 'Bank file format (ACB for ZA, NACHA for US, SEPA for EU)'
  })
  @IsOptional()
  @IsString()
  format?: 'ACB' | 'NACHA' | 'SEPA';

  @ApiPropertyOptional({ description: 'Payment reference prefix' })
  @IsOptional()
  @IsString()
  reference_prefix?: string;
}

export class GenerateGLJournalDto {
  @ApiPropertyOptional({ enum: ['CSV', 'JSON'], default: 'CSV' })
  @IsOptional()
  @IsEnum(['CSV', 'JSON'])
  format?: 'CSV' | 'JSON';

  @ApiPropertyOptional({ description: 'GL account mapping override' })
  @IsOptional()
  gl_mapping?: Record<string, string>;
}

export class ReportResponseDto {
  @ApiProperty({ example: 'art_123' })
  artifact_id: string;

  @ApiProperty({ enum: ReportType })
  report_type: ReportType;

  @ApiProperty({ example: 'payslips_pr_456_20250115.pdf' })
  filename: string;

  @ApiProperty({ example: 'application/pdf' })
  content_type: string;

  @ApiProperty({ example: 102400 })
  size_bytes: number;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  generated_at: string;

  @ApiPropertyOptional({ example: '/api/artifacts/art_123/download' })
  download_url?: string;
}

export class PayslipData {
  employee: {
    id: string;
    employee_no: string;
    full_name: string;
    national_id?: string;
    tax_number?: string;
  };
  employer: {
    name: string;
    registration_no?: string;
    address?: string;
  };
  pay_period: {
    start: string;
    end: string;
    payment_date: string;
  };
  earnings: Array<{
    description: string;
    hours?: number;
    rate?: number;
    amount: number;
  }>;
  deductions: Array<{
    description: string;
    amount: number;
  }>;
  totals: {
    gross: number;
    total_deductions: number;
    net: number;
    taxable_income: number;
    paye: number;
  };
  ytd?: {
    gross: number;
    paye: number;
    net: number;
  };
  bank_account?: {
    bank_name: string;
    branch_code?: string;
    masked_account: string;
  };
}

export class BankFileRecord {
  employee_id: string;
  employee_no: string;
  employee_name: string;
  bank_name: string;
  branch_code: string;
  account_number: string;
  account_type: string;
  amount: number;
  reference: string;
}

export class GLJournalEntry {
  account_code: string;
  account_name: string;
  debit: number;
  credit: number;
  reference: string;
  description: string;
  cost_center?: string;
}

export class PayrunSummaryReport {
  payrun: {
    id: string;
    name: string;
    status: string;
    pay_period: { start: string; end: string };
  };
  headcount: number;
  totals: {
    gross: number;
    taxable_income: number;
    paye: number;
    uif_employee: number;
    uif_employer: number;
    total_deductions: number;
    net: number;
    employer_cost: number;
  };
  by_department?: Array<{
    department: string;
    headcount: number;
    gross: number;
    net: number;
  }>;
  by_pay_item: Array<{
    code: string;
    name: string;
    type: string;
    total: number;
    count: number;
  }>;
}
