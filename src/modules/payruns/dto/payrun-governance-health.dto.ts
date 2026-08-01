/** RAG rollup for a single governance layer on this payrun. */
export type GovernanceRag = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

/** GOV-5A — supervisory snapshot for one payrun (control plane v1). */
export type PayrunGovernanceHealthDto = {
  payrun_id: string;
  pay_group_id: string;
  period_id: string | null;
  payrun_status: string;
  payrun_type: string;
  /** GOV-2 — payroll readiness for the pay group (execution permission). */
  readiness_status: GovernanceRag;
  readiness_percent: number | null;
  /** GOV-3A */
  financial_control_status: GovernanceRag;
  /** GOV-3B */
  bank_reconciliation_status: GovernanceRag;
  /** GOV-3C */
  gl_reconciliation_status: GovernanceRag;
  /** GOV-3D-1 — period closed vs open for this payrun’s period. */
  closed_period_status: 'OPEN' | 'CLOSED';
  /** GOV-3D-2 — governed reversal / correction posture (minimal rollup). */
  reversal_status: 'NONE' | 'ACTIVE' | 'ADJUSTMENT_LINKED';
  /** GOV-4 — post-close reconciliation impact. */
  post_close_impact_status: 'CLEAR' | 'PENDING';
  /** Audited overrides / bypasses recorded against this payrun (recent window). */
  override_count: number;
  override_types: string[];
  /** Human-readable blockers for operators / PMO (non-exhaustive v1). */
  unresolved_governance_blocks: string[];
  /** Worst-of critical pillars for leadership headline (excludes GREY-only). */
  overall_governance_rag: GovernanceRag;
  /** Truth ladder rows for UI (GOV-2 → GOV-4 active on payrun). */
  ladder: Array<{
    layer: string;
    label: string;
    rag: GovernanceRag;
    blocked_by?: string;
  }>;
};
