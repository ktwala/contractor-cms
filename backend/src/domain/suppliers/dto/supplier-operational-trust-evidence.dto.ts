import { ApiProperty } from '@nestjs/swagger';

export class SupplierOperationalTrustEventDto {
  @ApiProperty({ enum: ['GRANTED', 'RESTORED', 'SUSPENDED', 'DENIED'] })
  kind!: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';

  @ApiProperty()
  label!: string;

  @ApiProperty({ nullable: true })
  actorDisplayName!: string | null;

  @ApiProperty()
  occurredAt!: string;

  @ApiProperty({ nullable: true })
  reason!: string | null;
}

export class SupplierOperationalTrustEvidenceDto {
  @ApiProperty()
  supplierId!: string;

  @ApiProperty()
  currentStateLabel!: string;

  @ApiProperty({ nullable: true })
  oracleProcurementLabel!: string | null;

  @ApiProperty({ type: [SupplierOperationalTrustEventDto] })
  events!: SupplierOperationalTrustEventDto[];

  @ApiProperty({ type: SupplierOperationalTrustEventDto, nullable: true })
  latestGrant!: SupplierOperationalTrustEventDto | null;

  @ApiProperty({ type: SupplierOperationalTrustEventDto, nullable: true })
  latestSuspension!: SupplierOperationalTrustEventDto | null;
}
