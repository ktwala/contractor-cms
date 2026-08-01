/** Explicit population denominators — every Governance tab tile must declare what it counts. */
export const WORKFORCE_TELEMETRY_POPULATION_SCOPES = {
  assessedStagingWorkers:
    'Assessed HCM staging workers (discovery snapshot — not yet operationalized)',
  assessedStagingFindings: 'Readiness findings over assessed staging workers (may overlap)',
  supplierGovernanceProjection:
    'Supplier-level projection over the same assessed staging population',
  workforceResolutionTasks:
    'Open workforce resolution task records (workforce gaps only — not Supplier Governance)',
  materializedHcmContractors:
    'Materialized HCM contractors in the CMS workforce registry',
  operationalWorkforceState:
    'Lifecycle state views over the CMS registry (categories may overlap — not a partition of assessment)',
} as const;
