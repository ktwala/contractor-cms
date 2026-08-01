import { ApiProperty } from '@nestjs/swagger';

/** Supplier Governance finding projected into Workforce Discovery — subject is the supplier. */
export class SupplierOperationalTrustWorkforceImpactFindingDto {
  @ApiProperty()
  supplierId!: string;

  @ApiProperty()
  supplierName!: string;

  @ApiProperty({ description: 'SupplierStatus (PENDING_APPROVAL | SUSPENDED)' })
  operationalTrustStatus!: string;

  @ApiProperty({ example: 'Operational Trust Pending' })
  operationalTrustLabel!: string;

  @ApiProperty({
    description:
      'Discovered workers linked to this supplier that cannot be operationalized until trust is resolved',
  })
  affectedWorkerCount!: number;

  @ApiProperty({ example: 'Workers cannot be operationalized.' })
  impactSummary!: string;

  @ApiProperty({ example: 'Grant Operational Trust' })
  resolutionAction!: string;
}

/** Same staging pipeline scope as workforce readiness assessment (non-promoted discovery rows). */
export const SUPPLIER_GOVERNANCE_WORKFORCE_IMPACT_POPULATION_SCOPE =
  'Assessed HCM staging workers (same population as worker assessment findings)';

export class SupplierOperationalTrustWorkforceImpactDto {
  @ApiProperty({ type: [SupplierOperationalTrustWorkforceImpactFindingDto] })
  findings!: SupplierOperationalTrustWorkforceImpactFindingDto[];

  @ApiProperty({
    description:
      'Count of assessed staging workers in scope — matches workforce readiness assessment population',
  })
  workersAssessedPopulation!: number;

  @ApiProperty({
    description: 'Human-readable scope for operator-facing copy',
    example: SUPPLIER_GOVERNANCE_WORKFORCE_IMPACT_POPULATION_SCOPE,
  })
  populationScope!: string;

  @ApiProperty({
    description: 'ISO timestamp — reflects live supplier Operational Trust state, not assessment snapshot age',
  })
  evaluatedAt!: string;
}
