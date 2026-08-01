import { ConfigService } from '@nestjs/config';

/**
 * PR-SPONSOR-REFERENCE-ONLY-1 — when false (default), sponsor is HCM reference + IGA publish only.
 * When true, enables CMS sponsor inbox, row scope, and sponsor nav (legacy Option B).
 */
export const SPONSOR_ACCOUNTABILITY_INBOX_ENV = 'RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED';

export function isResponsibleManagerAccountabilityInboxEnabled(
  config: ConfigService,
): boolean {
  return config.get<string>(SPONSOR_ACCOUNTABILITY_INBOX_ENV) === 'true';
}
