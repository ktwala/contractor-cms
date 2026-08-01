import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum, IsBoolean, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { Country, PayItemType } from '../../../common/dto/enums.dto';

export class ListPayItemsDto {
  @ApiPropertyOptional({ enum: Country })
  @IsOptional()
  @IsEnum(Country)
  country?: Country;

  @ApiPropertyOptional({ enum: PayItemType })
  @IsOptional()
  @IsEnum(PayItemType)
  type?: PayItemType;

  @ApiPropertyOptional({ description: 'Filter by category' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Filter by pay group ID' })
  @IsOptional()
  @IsString()
  pay_group_id?: string;

  @ApiPropertyOptional({ default: false, description: 'Include inactive items' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  include_inactive?: boolean;
}
