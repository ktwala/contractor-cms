import { ConfigService } from '@nestjs/config';

export const HCM_ORACLE_STALE_THRESHOLD_HOURS_ENV =
  'HCM_ORACLE_STALE_THRESHOLD_HOURS';

const DEFAULT_STALE_THRESHOLD_HOURS = 24;

export function getHcmOracleStaleThresholdMs(config: ConfigService): number {
  const raw = config.get<string>(HCM_ORACLE_STALE_THRESHOLD_HOURS_ENV);
  const hours = raw ? Number.parseFloat(raw) : DEFAULT_STALE_THRESHOLD_HOURS;
  const safe = Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_STALE_THRESHOLD_HOURS;
  return safe * 60 * 60 * 1000;
}

export function isHcmOracleRestEnabled(config: ConfigService): boolean {
  return config.get<string>('HCM_ORACLE_REST_ENABLED') === 'true';
}
