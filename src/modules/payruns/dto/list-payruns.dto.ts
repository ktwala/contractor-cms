import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString, IsDateString } from 'class-validator';
import { Country, PayRunStatus } from '../../../common/dto/enums.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPayRunsDto extends PaginationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  pay_group_id?: string;

  @ApiPropertyOptional({ enum: Country })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_entity_id?: string;

  @ApiPropertyOptional({ enum: PayRunStatus })
  @IsOptional()
  @IsEnum(PayRunStatus)
  status?: PayRunStatus;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
