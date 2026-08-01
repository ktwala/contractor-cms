import { HcmOracleConnectorHealth } from '@prisma/client';
import { HcmOracleUpstreamFailureCode } from './oracle-hcm-upstream.errors';

export function healthFromHcmUpstreamCode(
  code: HcmOracleUpstreamFailureCode,
): HcmOracleConnectorHealth {
  switch (code) {
    case 'AUTH_FAILED':
      return HcmOracleConnectorHealth.AUTH_FAILED;
    case 'RATE_LIMITED':
      return HcmOracleConnectorHealth.RATE_LIMITED;
    default:
      return HcmOracleConnectorHealth.DEGRADED;
  }
}

export function isHcmConnectorSyncStale(
  lastSuccessfulSyncAt: Date | null | undefined,
  staleThresholdMs: number,
  now = new Date(),
): boolean {
  if (!lastSuccessfulSyncAt) {
    return false;
  }
  return now.getTime() - lastSuccessfulSyncAt.getTime() > staleThresholdMs;
}

/** PR-CTR-CONNECTOR-1D — effective REST connector health without running sync. */
export function evaluateHcmConnectorEffectiveHealth(input: {
  restEnabled: boolean;
  storedHealth: HcmOracleConnectorHealth;
  lastSuccessfulSyncAt: Date | null;
  staleThresholdMs: number;
  now?: Date;
}): HcmOracleConnectorHealth {
  if (!input.restEnabled) {
    return HcmOracleConnectorHealth.DISABLED;
  }

  if (!input.lastSuccessfulSyncAt) {
    return input.storedHealth;
  }

  if (
    isHcmConnectorSyncStale(
      input.lastSuccessfulSyncAt,
      input.staleThresholdMs,
      input.now,
    )
  ) {
    return HcmOracleConnectorHealth.STALE;
  }

  return input.storedHealth;
}
