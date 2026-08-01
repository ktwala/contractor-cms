import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsDateString, IsEmail } from 'class-validator';
import { EmployeeStatus } from '../../../common/dto/enums.dto';

export class CreateEmployeeDto {
  @ApiProperty({ example: 'HB-0001' })
  @IsString()
  @IsNotEmpty()
  employee_no: string;

  @ApiProperty({ example: 'Thabo' })
  @IsString()
  @IsNotEmpty()
  first_name: string;

  @ApiProperty({ example: 'Mokoena' })
  @IsString()
  @IsNotEmpty()
  last_name: string;

  @ApiPropertyOptional({ example: '9012015123456' })
  @IsOptional()
  @IsString()
  national_id?: string;

  @ApiPropertyOptional({ enum: EmployeeStatus, default: EmployeeStatus.ACTIVE })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiProperty({ example: '2024-01-15' })
  @IsDateString()
  hire_date: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsDateString()
  termination_date?: string;

  @ApiPropertyOptional({ example: 'thabo.mokoena@company.co.za' })
  @IsOptional()
  @IsEmail()
  email?: string;
}
