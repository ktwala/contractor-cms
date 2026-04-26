import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsUUID,
  IsString,
  IsDateString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InvoiceLineItemDto {
  @ApiProperty()
  @IsString()
  description: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  quantity: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitPrice: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  costCenterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  glAccountCode?: string;
}

export class CreateInvoiceDto {
  @ApiProperty()
  @IsUUID()
  supplierId: string;

  @ApiProperty()
  @IsString()
  invoiceNumber: string;

  @ApiProperty()
  @IsDateString()
  invoiceDate: string;

  @ApiProperty()
  @IsDateString()
  dueDate: string;

  @ApiProperty()
  @IsDateString()
  periodStart: string;

  @ApiProperty()
  @IsDateString()
  periodEnd: string;

  @ApiPropertyOptional({ default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiProperty({ type: [InvoiceLineItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvoiceLineItemDto)
  lineItems: InvoiceLineItemDto[];

  @ApiPropertyOptional({ type: [String], description: 'Timesheet IDs to link to this invoice' })
  @IsOptional()
  @IsArray()
  @IsUUID(undefined, { each: true })
  timesheetIds?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxClassificationId?: string;
}
