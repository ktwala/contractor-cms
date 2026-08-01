import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { Currency, Country } from '../../../common/dto/enums.dto';

// ============================================================================
// Compensation
// ============================================================================

export class CreateCompensationDto {
  @ApiProperty({ example: 45000.0, description: 'Monthly base salary' })
  @IsNumber()
  base_salary: number;

  @ApiProperty({ enum: Currency, example: 'ZAR' })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ example: '2025-01-01', description: 'Effective from date (YYYY-MM-DD)' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Effective to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @ApiPropertyOptional({ example: 'Annual salary increase' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CompensationResponseDto {
  @ApiProperty({ example: 'comp_123' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 45000.0 })
  base_salary: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ example: '2025-01-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  effective_to?: string | null;

  @ApiPropertyOptional()
  notes?: string | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  created_at: string;
}

// ============================================================================
// Bank Account
// ============================================================================

export enum AccountType {
  CHEQUE = 'CHEQUE',
  SAVINGS = 'SAVINGS',
  TRANSMISSION = 'TRANSMISSION',
}

export class CreateBankAccountDto {
  @ApiProperty({ example: 'First National Bank' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  bank_name: string;

  @ApiProperty({ example: '62012345678', description: 'Full account number (will be encrypted)' })
  @IsString()
  @MinLength(5)
  @MaxLength(34)
  account_number: string;

  @ApiPropertyOptional({ example: '250655', description: 'Branch code / Sort code' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  branch_code?: string;

  @ApiPropertyOptional({ enum: AccountType, example: 'CHEQUE' })
  @IsOptional()
  @IsEnum(AccountType)
  account_type?: AccountType;

  @ApiProperty({ example: '2025-01-01', description: 'Effective from date (YYYY-MM-DD)' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Effective to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;
}

export class BankAccountResponseDto {
  @ApiProperty({ example: 'ba_123' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 'First National Bank' })
  bank_name: string;

  @ApiProperty({ example: '****5678', description: 'Masked account number' })
  masked_account_number: string;

  @ApiPropertyOptional({ example: '250655' })
  branch_code?: string | null;

  @ApiPropertyOptional({ enum: AccountType })
  account_type?: AccountType | null;

  @ApiProperty({ example: '2025-01-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  effective_to?: string | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  created_at: string;
}

// ============================================================================
// Tax Profile
// ============================================================================

export enum ResidencyStatus {
  RESIDENT = 'RESIDENT',
  NON_RESIDENT = 'NON_RESIDENT',
  TEMPORARY_RESIDENT = 'TEMPORARY_RESIDENT',
}

export class CreateTaxProfileDto {
  @ApiProperty({ enum: Country, example: 'ZA' })
  @IsEnum(Country)
  country: Country;

  @ApiProperty({ enum: ResidencyStatus, example: 'RESIDENT' })
  @IsEnum(ResidencyStatus)
  residency_status: ResidencyStatus;

  @ApiPropertyOptional({ example: '9001015800089', description: 'Tax Identification Number (e.g., RSA ID for SA)' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  tin?: string;

  @ApiProperty({ example: '2025-01-01', description: 'Effective from date (YYYY-MM-DD)' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'Effective to date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;
}

export class TaxProfileResponseDto {
  @ApiProperty({ example: 'tp_123' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ enum: Country })
  country: Country;

  @ApiProperty({ enum: ResidencyStatus })
  residency_status: ResidencyStatus;

  @ApiPropertyOptional({ example: '9001015800089' })
  tin?: string | null;

  @ApiProperty({ example: '2025-01-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  effective_to?: string | null;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  created_at: string;
}

// ============================================================================
// Recurring Input
// ============================================================================

export class CreateRecurringInputDto {
  @ApiProperty({ example: 'OVERTIME', description: 'Pay item code' })
  @IsString()
  pay_item_code: string;

  @ApiProperty({ example: 500.0, description: 'Amount per period' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ enum: Currency, example: 'ZAR' })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiProperty({ example: '2025-01-01', description: 'Start date (YYYY-MM-DD)' })
  @IsDateString()
  start_date: string;

  @ApiPropertyOptional({ example: '2025-12-31', description: 'End date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ example: { reason: 'Monthly travel allowance' } })
  @IsOptional()
  meta?: Record<string, any>;
}

export class RecurringInputResponseDto {
  @ApiProperty({ example: 'ri_123' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 'OVERTIME' })
  pay_item_code: string;

  @ApiProperty({ example: 500.0 })
  amount: number;

  @ApiProperty({ enum: Currency })
  currency: Currency;

  @ApiProperty({ example: '2025-01-01' })
  start_date: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  end_date?: string | null;

  @ApiPropertyOptional()
  meta?: Record<string, any>;

  @ApiProperty({ example: true })
  is_active: boolean;

  @ApiProperty({ example: '2025-01-15T10:30:00.000Z' })
  created_at: string;
}
