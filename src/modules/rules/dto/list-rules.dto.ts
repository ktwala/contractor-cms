import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsDateString } from 'class-validator';
import { Country } from '../../../common/dto/enums.dto';

export class ListRulesDto {
  @ApiPropertyOptional({ enum: Country })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsDateString()
  effective_on?: string;
}
