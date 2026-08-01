import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class GlConfirmationReviewDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
