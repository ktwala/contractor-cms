import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsNumber, IsOptional, IsEnum, IsObject } from 'class-validator';
import { Currency } from '../../../common/dto/enums.dto';

export class LineItemInputDto {
  @ApiProperty({ example: 'emp_1' })
  @IsString()
  @IsNotEmpty()
  employee_id: string;

  @ApiProperty({ example: 'OVERTIME' })
  @IsString()
  @IsNotEmpty()
  pay_item_code: string;

  @ApiProperty({ example: 1500.0 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  currency?: Currency;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  meta?: Record<string, any>;
}

export class LineItemInputResponseDto {
  @ApiProperty({ example: 'li_123' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 'OVERTIME' })
  pay_item_code: string;

  @ApiProperty({ example: 1500.0 })
  amount: number;

  @ApiPropertyOptional({ enum: Currency })
  currency?: Currency;

  @ApiPropertyOptional()
  meta?: Record<string, any>;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}
