import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsArray, IsString, IsOptional, IsDateString } from 'class-validator';

export class GenerateInvoiceFromTimesheetsDto {
  @ApiProperty({ type: [String], description: 'Approved timesheet IDs to include' })
  @IsArray()
  @IsUUID(undefined, { each: true })
  timesheetIds: string[];

  @ApiProperty()
  @IsString()
  invoiceNumber: string;

  @ApiProperty()
  @IsDateString()
  invoiceDate: string;

  @ApiProperty()
  @IsDateString()
  dueDate: string;

  @ApiPropertyOptional({ default: 'ZAR' })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  taxClassificationId?: string;
}

export class ApproveInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class RejectInvoiceDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;
}

export class MarkInvoicePaidDto {
  @ApiProperty()
  @IsString()
  paymentReference: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  paidAt?: string;
}
