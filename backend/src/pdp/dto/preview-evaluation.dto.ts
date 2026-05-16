import { IsDateString, IsOptional, IsString } from 'class-validator';
import { PdpAction } from '../pdp.types';

export class PreviewEvaluationDto {
  @IsString()
  action: PdpAction;

  @IsOptional()
  @IsString()
  organizationId?: string;

  @IsString()
  supplierId: string;

  @IsOptional()
  @IsString()
  contractorId?: string;

  @IsOptional()
  @IsString()
  poId?: string;

  @IsOptional()
  @IsString()
  timesheetId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsDateString()
  transactionDate: string;
}
