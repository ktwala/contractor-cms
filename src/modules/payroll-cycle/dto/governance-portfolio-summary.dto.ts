/** GOV-5B — portfolio-level governance rollup for a period, pay group, or legal entity. */
export type GovernancePortfolioScope = 'period' | 'pay_group' | 'legal_entity';

export type GovernancePortfolioSummaryDto = {
  scope: GovernancePortfolioScope;
  scope_id: string;
  /** Human-readable label (period dates, pay group code, entity name). */
  label: string | null;
  total_payruns: number;
  /** Distinct payruns with any of 3A/3B/3C in BLOCKED. */
  blocked_payruns_count: number;
  /** Payruns with any GOV-4 impact flag still set. */
  stale_post_close_impact_count: number;
  /** Audit log rows (override / bypass heuristics) for PayRun entities in scope. */
  override_event_count: number;
  /** Distinct payruns with financial control BLOCKED or VARIANCE awaiting review. */
  financial_exception_payruns: number;
  /** Distinct payruns with bank reconciliation BLOCKED or variance/reject/partial awaiting review. */
  bank_exception_payruns: number;
  /** Distinct payruns with GL reconciliation BLOCKED or VARIANCE awaiting review. */
  gl_exception_payruns: number;
  /** PayrunException rows in OPEN or ASSIGNED for payruns in scope. */
  open_payrun_exceptions_count: number;
};
