import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { Country, EmploymentType } from '../../../common/dto/enums.dto';

export class CreateEmploymentDto {
  @ApiProperty({ example: 'le_za_001' })
  @IsString()
  @IsNotEmpty()
  legal_entity_id: string;

  @ApiPropertyOptional({ example: 'pg_za_123', description: 'Optional payroll assignment. Required only for payroll processing.' })
  @IsOptional()
  @IsString()
  pay_group_id?: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  @IsEnum(Country)
  country: Country;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  @IsOptional()
  @IsString()
  job_title?: string;

  @ApiPropertyOptional({ example: 'ENG-001' })
  @IsOptional()
  @IsString()
  cost_center?: string;

  @ApiProperty({ description: 'Org unit (required for reporting hierarchy)' })
  @IsString()
  @IsNotEmpty()
  org_unit_id: string;

  @ApiPropertyOptional({ example: 'cc_payroll_001' })
  @IsOptional()
  @IsString()
  cost_center_id?: string;

  @ApiPropertyOptional({ description: 'Position (optional; must match org unit and legal entity)' })
  @IsOptional()
  @IsString()
  position_id?: string;

  @ApiPropertyOptional({ enum: EmploymentType, default: EmploymentType.PERMANENT })
  @IsOptional()
  @IsEnum(EmploymentType)
  employment_type?: EmploymentType;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  effective_to?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
