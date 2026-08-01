import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum ImpactReviewStatus {
  REVIEWED = 'REVIEWED',
  ACCEPTED = 'ACCEPTED',
  CONCERNS_RAISED = 'CONCERNS_RAISED',
  REJECTED = 'REJECTED',
}

export class CreateImpactReviewDto {
  @ApiProperty({ enum: ImpactReviewStatus })
  @IsEnum(ImpactReviewStatus)
  reviewStatus!: ImpactReviewStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reviewComment?: string;
}
