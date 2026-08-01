import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { Country } from '../../../common/dto/enums.dto';
import { PaginationDto } from '../../../common/dto/pagination.dto';

export class ListLegalEntitiesDto extends PaginationDto {
  @ApiPropertyOptional({ enum: Country })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;
}
