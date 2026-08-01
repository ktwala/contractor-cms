import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EmployeeStatus, Currency, Country, ResidencyStatus } from '../../../common/dto/enums.dto';

export class EmployeeResponseDto {
  @ApiProperty({ example: 'emp_1' })
  id: string;

  @ApiProperty({ example: 'HB-0001' })
  employee_no: string;

  @ApiProperty({ example: 'Thabo' })
  first_name: string;

  @ApiProperty({ example: 'Mokoena' })
  last_name: string;

  @ApiPropertyOptional({ example: '9012015123456' })
  national_id?: string;

  @ApiPropertyOptional({ example: 'thabo.mokoena@company.co.za' })
  email?: string;

  @ApiProperty({ enum: EmployeeStatus, example: EmployeeStatus.ACTIVE })
  status: EmployeeStatus;

  @ApiProperty({ example: '2024-01-15' })
  hire_date: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  termination_date?: string | null;

  @ApiPropertyOptional({ example: 'Engineering' })
  department?: string | null;

  @ApiPropertyOptional({ example: 'Senior Engineer' })
  job_title?: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;

  @ApiPropertyOptional({ example: '2026-01-16T14:00:00.000Z' })
  updated_at?: string | null;
}

export class PaginatedEmployeesDto {
  @ApiProperty({ type: [EmployeeResponseDto] })
  items: EmployeeResponseDto[];

  @ApiProperty({ example: 0 })
  offset: number;

  @ApiProperty({ example: 50 })
  limit: number;

  @ApiProperty({ example: 100 })
  total: number;
}

export class CompensationItemDto {
  @ApiProperty({ example: 'cmp_1' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 25000.0 })
  base_salary: number;

  @ApiProperty({ enum: Currency, example: Currency.ZAR })
  currency: Currency;

  @ApiProperty({ example: '2024-01-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  effective_to?: string | null;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class CompensationHistoryResponseDto {
  @ApiProperty({ type: [CompensationItemDto] })
  items: CompensationItemDto[];
}

export class BankAccountItemDto {
  @ApiProperty({ example: 'ba_1' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 'Standard Bank' })
  bank_name: string;

  @ApiProperty({ example: '******7890' })
  masked_account_number: string;

  @ApiPropertyOptional({ example: '051001' })
  branch_code?: string;

  @ApiPropertyOptional({ example: 'CHEQUE' })
  account_type?: string;

  @ApiProperty({ example: '2024-01-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  effective_to?: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class BankAccountHistoryResponseDto {
  @ApiProperty({ type: [BankAccountItemDto] })
  items: BankAccountItemDto[];
}

export class TaxProfileItemDto {
  @ApiProperty({ example: 'tp_1' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  country: Country;

  @ApiProperty({ enum: ResidencyStatus, example: ResidencyStatus.RESIDENT })
  residency_status: ResidencyStatus;

  @ApiPropertyOptional({ example: '9012015123456' })
  tin?: string;

  @ApiProperty({ example: '2024-01-01' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2024-12-31' })
  effective_to?: string | null;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class TaxProfileHistoryResponseDto {
  @ApiProperty({ type: [TaxProfileItemDto] })
  items: TaxProfileItemDto[];
}
