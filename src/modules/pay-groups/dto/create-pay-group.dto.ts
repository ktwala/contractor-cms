import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsEnum, IsOptional, IsObject, ValidateNested, IsInt, Min, Max, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { Country, Currency, PayFrequency } from '../../../common/dto/enums.dto';

/**
 * Pay day rule for monthly payroll:
 * - 'fixed': Use pay_day (e.g. 25); if it falls on weekend, move to previous Friday.
 * - 'last_working_day': Use last day of month; if it falls on Saturday/Sunday, use last Friday.
 */
export type PayDayRule = 'fixed' | 'last_working_day';

export class DefaultCalendarDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  cutoff_day?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 31 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  pay_day?: number;

  @ApiPropertyOptional({
    enum: ['fixed', 'last_working_day'],
    description:
      "Pay day rule. 'fixed' = use pay_day, adjust for weekend. 'last_working_day' = last day of month, or last Friday if month ends on weekend.",
  })
  @IsOptional()
  @IsIn(['fixed', 'last_working_day'])
  pay_day_rule?: PayDayRule;
}

export class GlDefaultsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  suspense_account?: string;
}

export class CreatePayGroupDto {
  @ApiProperty({ example: 'ZA-MONTHLY-SALARIED' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: 'South Africa Monthly Salaried' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  @IsEnum(Country)
  country: Country;

  @ApiProperty({ enum: Currency, example: Currency.ZAR })
  @IsEnum(Currency)
  currency: Currency;

  @ApiProperty({ enum: PayFrequency, example: PayFrequency.MONTHLY })
  @IsEnum(PayFrequency)
  frequency: PayFrequency;

  @ApiProperty({ example: 'le_za_001' })
  @IsString()
  @IsNotEmpty()
  legal_entity_id: string;

  @ApiPropertyOptional({ type: DefaultCalendarDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => DefaultCalendarDto)
  default_calendar?: DefaultCalendarDto;

  @ApiPropertyOptional({ type: GlDefaultsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GlDefaultsDto)
  gl_defaults?: GlDefaultsDto;
}
