import { IsOptional, IsString } from 'class-validator';

export class ConfirmPaymentBatchDto {
  @IsOptional()
  @IsString()
  confirmationNote?: string;
}
