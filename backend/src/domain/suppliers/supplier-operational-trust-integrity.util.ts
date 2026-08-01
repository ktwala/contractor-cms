import {
  SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS,
  SupplierGovernanceIntegrityStatus,
} from './supplier-operational-trust-integrity.constants';
import {
  SupplierOperationalTrustIntegrityInvariantResultDto,
  SupplierOperationalTrustIntegrityReportDto,
  SupplierOperationalTrustIntegrityViolationDto,
} from './dto/supplier-operational-trust-integrity.dto';

export function buildIntegrityInvariantResult(input: {
  id: (typeof SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS)[number]['id'];
  violations: SupplierOperationalTrustIntegrityViolationDto[];
}): SupplierOperationalTrustIntegrityInvariantResultDto {
  const definition = SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS.find((inv) => inv.id === input.id)!;
  const violationCount = input.violations.length;
  return {
    id: definition.id,
    name: definition.name,
    businessTruth: definition.businessTruth,
    status: violationCount === 0 ? 'PASS' : 'FAIL',
    violationCount,
    violations: input.violations,
  };
}

export function assembleIntegrityReport(
  invariants: SupplierOperationalTrustIntegrityInvariantResultDto[],
): SupplierOperationalTrustIntegrityReportDto {
  const violations = invariants.reduce((sum, inv) => sum + inv.violationCount, 0);
  const integrity: SupplierGovernanceIntegrityStatus =
    violations === 0 ? 'PASS' : 'FAIL';

  return {
    integrity,
    evaluatedInvariants: SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS.length,
    violations,
    invariants,
    evaluatedAt: new Date().toISOString(),
  };
}

export function emptyIntegrityReport(): SupplierOperationalTrustIntegrityReportDto {
  return assembleIntegrityReport(
    SUPPLIER_GOVERNANCE_INTEGRITY_INVARIANTS.map((definition) =>
      buildIntegrityInvariantResult({ id: definition.id, violations: [] }),
    ),
  );
}
