import { ApiProperty } from '@nestjs/swagger';
import {
  SupplierGovernanceIntegrityStatus,
} from '../supplier-operational-trust-integrity.constants';

export class SupplierOperationalTrustIntegrityViolationDto {
  @ApiProperty({ example: 'Operational worker linked to suspended supplier' })
  summary!: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { contractorId: 'ctr-1', supplierId: 'sup-1', supplierName: 'Atlas Consulting' },
  })
  context!: Record<string, string | number>;
}

export class SupplierOperationalTrustIntegrityInvariantResultDto {
  @ApiProperty({ example: 'OPERATIONAL_WORKER_REQUIRES_GRANTED_TRUST' })
  id!: string;

  @ApiProperty({ example: 'Operational worker requires granted trust' })
  name!: string;

  @ApiProperty({ example: 'Operational worker ⇒ Supplier Operational Trust = Granted' })
  businessTruth!: string;

  @ApiProperty({ enum: ['PASS', 'FAIL'] })
  status!: SupplierGovernanceIntegrityStatus;

  @ApiProperty()
  violationCount!: number;

  @ApiProperty({ type: [SupplierOperationalTrustIntegrityViolationDto] })
  violations!: SupplierOperationalTrustIntegrityViolationDto[];
}

export class SupplierOperationalTrustIntegrityReportDto {
  @ApiProperty({
    enum: ['PASS', 'FAIL'],
    description: 'PASS when every Supplier Governance invariant holds',
  })
  integrity!: SupplierGovernanceIntegrityStatus;

  @ApiProperty({ description: 'Number of invariants evaluated' })
  evaluatedInvariants!: number;

  @ApiProperty({ description: 'Total violation records across all invariants' })
  violations!: number;

  @ApiProperty({ type: [SupplierOperationalTrustIntegrityInvariantResultDto] })
  invariants!: SupplierOperationalTrustIntegrityInvariantResultDto[];

  @ApiProperty()
  evaluatedAt!: string;
}
