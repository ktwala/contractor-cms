/** PR-CMS-INT-3 — canonical upstream source identifiers for adapter registry. */
export const SOURCE_SYSTEM_IDS = {
  ORACLE_PROCUREMENT: 'ORACLE_PROCUREMENT',
  ORACLE_HCM: 'ORACLE_HCM',
  CMS_NATIVE: 'CMS_NATIVE',
} as const;

export type SourceSystemId =
  (typeof SOURCE_SYSTEM_IDS)[keyof typeof SOURCE_SYSTEM_IDS];
