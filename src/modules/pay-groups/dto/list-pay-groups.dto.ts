import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsString } from 'class-validator';
import { Country } from '../../../common/dto/enums.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListPayGroupsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Country })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  legal_entity_id?: string;
}
