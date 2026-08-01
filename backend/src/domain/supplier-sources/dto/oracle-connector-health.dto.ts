import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OracleSupplierConnectorHealth } from '@prisma/client';

export class OracleConnectorHealthResponseDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty({ enum: OracleSupplierConnectorHealth })
  health: OracleSupplierConnectorHealth;

  @ApiProperty({
    description: 'Whether ORACLE_PROCUREMENT_REST_ENABLED=true for this deployment',
  })
  restEnabled: boolean;

  @ApiPropertyOptional()
  lastSuccessfulSyncAt: string | null;

  @ApiPropertyOptional()
  lastCursor: string | null;

  @ApiPropertyOptional()
  lastError: string | null;

  @ApiProperty()
  staleThresholdHours: number;

  @ApiProperty({
    description: 'True when last successful sync is older than stale threshold',
  })
  isStale: boolean;

  @ApiProperty()
  evaluatedAt: string;
}
