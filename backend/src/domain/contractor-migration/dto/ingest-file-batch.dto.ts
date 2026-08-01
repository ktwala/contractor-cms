import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export class IngestFileBatchDto {
  @ApiPropertyOptional({
    description: 'Target organization (required for global CMS_ADMIN)',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiProperty({ enum: ['json', 'csv'], description: 'Extract file format' })
  @IsIn(['json', 'csv'])
  format!: 'json' | 'csv';

  @ApiProperty({ description: 'Raw file body (JSON array or CSV text)' })
  @IsString()
  @MinLength(2)
  content!: string;

  @ApiPropertyOptional({ description: 'Original file name for audit' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: 'Migration wave label' })
  @IsOptional()
  @IsString()
  waveLabel?: string;

  @ApiPropertyOptional({
    description: 'Parse-only; does not persist staging rows',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
