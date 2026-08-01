/**
 * Lesotho (LS) statutory bootstrap / snapshot readiness card copy only.
 *
 * PR-TAX-GOV-2C.1: Do not add South Africa–only statutory contribution labels here — operators must not
 * infer LS obligations from ZA rules. Enforced by `scripts/check_statutory_config_country_copy_drift.ts`.
 */

/** Text after `As of {date} (UTC).` on the LS readiness card. */
export const LS_READINESS_SUFFIX =
  'Snapshot engine needs an active compute pack and PAYE TaxTableSet.';

export const LS_OPERATOR_BOOTSTRAP_HEADING = 'Operator bootstrap (LS):';

export function lsStatutoryConfigsPillLabel(expectedTypes: string[]): string {
  if (expectedTypes.length === 0) {
    return 'Statutory configs (none required for LS routing)';
  }
  return `Statutory configs (${expectedTypes.join(', ')})`;
}
