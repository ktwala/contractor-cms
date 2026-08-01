import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { EmployeeStatus } from '../../../common/dto/enums.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListEmployeesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: EmployeeStatus })
  @IsOptional()
  @IsEnum(EmployeeStatus)
  status?: EmployeeStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pay_group_id?: string;

  @ApiPropertyOptional({ description: 'Free-text search (name, employee_no, national_id)' })
  @IsOptional()
  @IsString()
  q?: string;
}
