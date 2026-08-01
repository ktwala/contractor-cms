import { ConfigService } from '@nestjs/config';

/** PR-CMS-CONNECTOR-1E — hours without successful sync before STALE. */
export const ORACLE_PROCUREMENT_STALE_THRESHOLD_HOURS_ENV =
  'ORACLE_PROCUREMENT_STALE_THRESHOLD_HOURS';

const DEFAULT_STALE_THRESHOLD_HOURS = 24;

export function getOracleProcurementStaleThresholdMs(
  config: ConfigService,
): number {
  const raw = config.get<string>(ORACLE_PROCUREMENT_STALE_THRESHOLD_HOURS_ENV);
  const hours = raw ? Number.parseFloat(raw) : DEFAULT_STALE_THRESHOLD_HOURS;
  const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_STALE_THRESHOLD_HOURS;
  return safe * 60 * 60 * 1000;
}

export function isOracleProcurementRestEnabled(config: ConfigService): boolean {
  return config.get<string>('ORACLE_PROCUREMENT_REST_ENABLED') === 'true';
}
