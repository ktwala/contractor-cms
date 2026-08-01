import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsUUID,
} from 'class-validator';

export enum ImportType {
  EMPLOYEES = 'EMPLOYEES',
  RECURRING_INPUTS = 'RECURRING_INPUTS',
  PAY_ITEMS = 'PAY_ITEMS',
  LINE_ITEM_INPUTS = 'LINE_ITEM_INPUTS',
}

export enum ImportStatus {
  PENDING = 'PENDING',
  VALIDATING = 'VALIDATING',
  VALIDATED = 'VALIDATED',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum ImportMode {
  CREATE_ONLY = 'CREATE_ONLY',      // Only create new records
  UPDATE_ONLY = 'UPDATE_ONLY',      // Only update existing records
  UPSERT = 'UPSERT',                // Create or update
}

// ============================================================================
// Import DTOs
// ============================================================================

export class CreateImportDto {
  @ApiProperty({ enum: ImportType })
  @IsEnum(ImportType)
  type: ImportType;

  @ApiPropertyOptional({ enum: ImportMode, default: ImportMode.UPSERT })
  @IsOptional()
  @IsEnum(ImportMode)
  mode?: ImportMode;

  @ApiPropertyOptional({ description: 'Pay group ID for recurring/line item imports' })
  @IsOptional()
  @IsUUID()
  pay_group_id?: string;

  @ApiPropertyOptional({ description: 'PayRun ID for line item imports' })
  @IsOptional()
  @IsUUID()
  payrun_id?: string;

  @ApiPropertyOptional({ description: 'Skip rows with validation errors' })
  @IsOptional()
  @IsBoolean()
  skip_errors?: boolean;
}

export class ImportValidationError {
  @ApiProperty({ type: Number })
  row: number;

  @ApiProperty({ type: String })
  field: string;

  @ApiProperty({ type: String })
  value: string;

  @ApiProperty({ type: String })
  message: string;
}

export class ImportPreviewRow {
  @ApiProperty()
  row_number: number;

  @ApiProperty()
  data: Record<string, any>;

  @ApiProperty()
  action: 'CREATE' | 'UPDATE' | 'SKIP';

  @ApiPropertyOptional()
  existing_id?: string;

  @ApiProperty({ type: () => [ImportValidationError] })
  errors: ImportValidationError[];

  @ApiProperty({ type: [String] })
  warnings: string[];
}

export class ImportPreviewResponseDto {
  @ApiProperty()
  import_id: string;

  @ApiProperty({ enum: ImportType })
  type: ImportType;

  @ApiProperty()
  total_rows: number;

  @ApiProperty()
  valid_rows: number;

  @ApiProperty()
  error_rows: number;

  @ApiProperty()
  to_create: number;

  @ApiProperty()
  to_update: number;

  @ApiProperty()
  to_skip: number;

  @ApiProperty({ type: () => [ImportPreviewRow] })
  preview: ImportPreviewRow[];

  @ApiProperty({ type: () => [ImportValidationError] })
  global_errors: ImportValidationError[];

  @ApiProperty()
  can_proceed: boolean;
}

export class ImportResultDto {
  @ApiProperty()
  import_id: string;

  @ApiProperty({ enum: ImportStatus })
  status: ImportStatus;

  @ApiProperty()
  total_rows: number;

  @ApiProperty()
  created: number;

  @ApiProperty()
  updated: number;

  @ApiProperty()
  skipped: number;

  @ApiProperty()
  failed: number;

  @ApiProperty({ type: () => [ImportValidationError] })
  errors: ImportValidationError[];

  @ApiPropertyOptional()
  completed_at?: string;
}

// ============================================================================
// Export DTOs
// ============================================================================

export enum ExportType {
  EMPLOYEES = 'EMPLOYEES',
  PAY_ITEMS = 'PAY_ITEMS',
  RECURRING_INPUTS = 'RECURRING_INPUTS',
  PAYRUN_RESULTS = 'PAYRUN_RESULTS',
}

export class CreateExportDto {
  @ApiProperty({ enum: ExportType })
  @IsEnum(ExportType)
  type: ExportType;

  @ApiPropertyOptional({ description: 'Filter by pay group' })
  @IsOptional()
  @IsUUID()
  pay_group_id?: string;

  @ApiPropertyOptional({ description: 'Filter by legal entity' })
  @IsOptional()
  @IsUUID()
  legal_entity_id?: string;

  @ApiPropertyOptional({ description: 'PayRun ID for results export' })
  @IsOptional()
  @IsUUID()
  payrun_id?: string;

  @ApiPropertyOptional({ description: 'Include inactive records' })
  @IsOptional()
  @IsBoolean()
  include_inactive?: boolean;
}

// ============================================================================
// Template DTOs
// ============================================================================

export class ImportTemplateDto {
  @ApiProperty({ enum: ImportType })
  @IsEnum(ImportType)
  type: ImportType;
}

// Column definitions for each import type
export const IMPORT_COLUMNS: Record<ImportType, { name: string; required: boolean; description: string }[]> = {
  [ImportType.EMPLOYEES]: [
    { name: 'employee_number', required: true, description: 'Unique employee identifier' },
    { name: 'first_name', required: true, description: 'First name' },
    { name: 'last_name', required: true, description: 'Last name' },
    { name: 'national_id', required: true, description: 'National ID number' },
    { name: 'email', required: false, description: 'Email address' },
    { name: 'phone', required: false, description: 'Phone number' },
    { name: 'hire_date', required: true, description: 'Hire date (YYYY-MM-DD)' },
    { name: 'department', required: false, description: 'Department name' },
    { name: 'job_title', required: false, description: 'Job title' },
    { name: 'employment_type', required: false, description: 'PERMANENT, CONTRACT, or CASUAL' },
    { name: 'base_salary', required: true, description: 'Monthly base salary' },
    { name: 'bank_name', required: false, description: 'Bank name' },
    { name: 'bank_branch_code', required: false, description: 'Branch code' },
    { name: 'account_number', required: false, description: 'Account number' },
    { name: 'account_type', required: false, description: 'CHEQUE, SAVINGS, or CURRENT' },
    { name: 'tax_number', required: false, description: 'Tax reference number' },
  ],
  [ImportType.RECURRING_INPUTS]: [
    { name: 'employee_number', required: true, description: 'Employee identifier' },
    { name: 'pay_item_code', required: true, description: 'Pay item code (e.g., OVERTIME)' },
    { name: 'amount', required: true, description: 'Amount' },
    { name: 'start_date', required: true, description: 'Start date (YYYY-MM-DD)' },
    { name: 'end_date', required: false, description: 'End date (YYYY-MM-DD), empty for ongoing' },
  ],
  [ImportType.PAY_ITEMS]: [
    { name: 'code', required: true, description: 'Unique pay item code' },
    { name: 'name', required: true, description: 'Display name' },
    { name: 'type', required: true, description: 'EARNING, DEDUCTION, TAX, or EMPLOYER_CONTRIB' },
    { name: 'taxable', required: false, description: 'Is taxable (true/false)' },
    { name: 'gl_account', required: false, description: 'GL account code' },
    { name: 'formula', required: false, description: 'Calculation formula' },
    { name: 'sort_order', required: false, description: 'Display order' },
  ],
  [ImportType.LINE_ITEM_INPUTS]: [
    { name: 'employee_number', required: true, description: 'Employee identifier' },
    { name: 'pay_item_code', required: true, description: 'Pay item code' },
    { name: 'amount', required: true, description: 'Amount' },
  ],
};
