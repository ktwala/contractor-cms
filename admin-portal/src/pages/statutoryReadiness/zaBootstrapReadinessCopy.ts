/**
 * South Africa (ZA) statutory bootstrap / snapshot readiness card copy.
 */

/** Text after `As of {date} (UTC).` on the ZA readiness card. */
export const ZA_READINESS_SUFFIX =
  'Snapshot engine needs pack + PAYE; ZA also expects UIF, SDL, and MTC rows from statutory seed.';

export const ZA_OPERATOR_BOOTSTRAP_HEADING = 'Operator bootstrap (ZA):';

export function zaStatutoryConfigsPillLabel(expectedTypes: string[]): string {
  if (expectedTypes.length === 0) return 'Statutory configs (expected UIF, SDL, MTC when seeded)';
  return `Statutory configs (${expectedTypes.join(', ')})`;
}
