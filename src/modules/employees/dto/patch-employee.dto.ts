import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString, IsEmail, IsUUID, IsString } from 'class-validator';
import { EmployeeStatus } from '../../../common/dto/enums.dto';

export class PatchEmployeeDto {
  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  termination_date?: string | null;

  @ApiPropertyOptional({ example: 'thabo.mokoena@company.co.za' })
  @IsOptional()
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({ example: 'uuid-of-manager-employee' })
  @IsOptional()
  @IsUUID()
  manager_id?: string | null;

  @ApiPropertyOptional({ example: 'Thabo' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Mokoena' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsDateString()
  hire_date?: string;

  @ApiPropertyOptional({ example: 'Engineering' })
  @IsOptional()
  @IsString()
  department?: string | null;

  @ApiPropertyOptional({ example: 'Senior Engineer' })
  @IsOptional()
  @IsString()
  job_title?: string | null;
}
