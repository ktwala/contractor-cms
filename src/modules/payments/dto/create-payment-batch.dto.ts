import { IsNotEmpty, IsString } from 'class-validator';

export class CreatePaymentBatchDto {
  @IsString()
  @IsNotEmpty()
  payrunId!: string;
}
