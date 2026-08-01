import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class IngestOracleRestBatchDto {
  @ApiPropertyOptional({
    description: 'Target organization (required for global CMS_ADMIN)',
  })
  @IsOptional()
  @IsString()
  organizationId?: string;

  @ApiPropertyOptional({ description: 'Migration wave label' })
  @IsOptional()
  @IsString()
  waveLabel?: string;

  @ApiPropertyOptional({
    description: 'Oracle effective date / cursor (passed as effectiveDate query param)',
  })
  @IsOptional()
  @IsString()
  since?: string;

  @ApiPropertyOptional({
    description: 'Fetch and parse only; does not persist staging rows',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;
}
