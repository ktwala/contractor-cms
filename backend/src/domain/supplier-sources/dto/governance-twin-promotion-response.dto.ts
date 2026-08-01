import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { SupplierSourceSystem, SupplierStatus } from '@prisma/client';

export class GovernanceTwinPromotionResultDto {
  @ApiProperty()
  stagingId: string;

  @ApiProperty({ enum: ['CREATED', 'LINKED'] })
  outcome: 'CREATED' | 'LINKED';

  @ApiProperty()
  supplierId: string;

  @ApiProperty({ enum: SupplierStatus })
  status: SupplierStatus;

  @ApiProperty()
  externalSupplierId: string;

  @ApiProperty({ enum: SupplierSourceSystem })
  sourceSystem: SupplierSourceSystem;

  @ApiPropertyOptional()
  idempotent?: boolean;
}

export class PromoteOracleStagingBatchErrorDto {
  @ApiProperty()
  stagingId: string;

  @ApiProperty()
  message: string;

  @ApiPropertyOptional()
  code?: string;
}

export class PromoteOracleStagingBatchResponseDto {
  @ApiProperty()
  promoted: number;

  @ApiProperty()
  failed: number;

  @ApiProperty({ type: [GovernanceTwinPromotionResultDto] })
  results: GovernanceTwinPromotionResultDto[];

  @ApiProperty({ type: [PromoteOracleStagingBatchErrorDto] })
  errors: PromoteOracleStagingBatchErrorDto[];
}
