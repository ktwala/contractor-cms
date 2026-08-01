import { ApiProperty } from '@nestjs/swagger';

/** Workforce discovery — workers blocked because linked supplier lacks Operational Trust. */
export class OperationalTrustWorkerBlockDto {
  @ApiProperty()
  supplierId!: string;

  @ApiProperty()
  supplierName!: string;

  @ApiProperty({ description: 'SupplierStatus value (e.g. PENDING_APPROVAL, SUSPENDED)' })
  supplierStatus!: string;

  @ApiProperty({
    description: 'Discovered workers that cannot be operationalized until trust is granted',
  })
  blockedWorkerCount!: number;
}
