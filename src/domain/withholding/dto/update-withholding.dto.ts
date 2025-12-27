import { PartialType } from '@nestjs/swagger';
import { CreateWithholdingDto } from './create-withholding.dto';
import { IsEnum, IsOptional, IsString, IsDateString, IsInt } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export enum SyncStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  SYNCED = 'SYNCED',
  FAILED = 'FAILED',
}

export class UpdateWithholdingDto extends PartialType(CreateWithholdingDto) {
  @ApiPropertyOptional({ enum: SyncStatus })
  @IsOptional()
  @IsEnum(SyncStatus)
  syncStatus?: SyncStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  externalReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  syncedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  syncError?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  retryCount?: number;
}
