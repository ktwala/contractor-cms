import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ChangeRequestKind, ChangeRequestStatus } from '../../../common/dto/enums.dto';

export class ListChangeRequestsDto {
  @ApiPropertyOptional({ example: 'emp_123' })
  @IsOptional()
  @IsString()
  employee_id?: string;

  @ApiPropertyOptional({ enum: ChangeRequestKind })
  @IsOptional()
  @IsEnum(ChangeRequestKind)
  kind?: ChangeRequestKind;

  @ApiPropertyOptional({ enum: ChangeRequestStatus })
  @IsOptional()
  @IsEnum(ChangeRequestStatus)
  status?: ChangeRequestStatus;

  @ApiPropertyOptional({ example: 'user_789' })
  @IsOptional()
  @IsString()
  requested_by?: string;

  @ApiPropertyOptional({ example: 'ent_001' })
  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
