import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BankConfirmationReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
