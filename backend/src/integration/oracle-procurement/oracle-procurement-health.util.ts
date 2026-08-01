import { OracleSupplierConnectorHealth } from '@prisma/client';
import { OracleUpstreamFailureCode } from './oracle-procurement-upstream.errors';

export function healthFromUpstreamCode(
  code: OracleUpstreamFailureCode,
): OracleSupplierConnectorHealth {
  switch (code) {
    case 'AUTH_FAILED':
      return OracleSupplierConnectorHealth.AUTH_FAILED;
    case 'RATE_LIMITED':
      return OracleSupplierConnectorHealth.RATE_LIMITED;
    default:
      return OracleSupplierConnectorHealth.DEGRADED;
  }
}

export function isConnectorSyncStale(
  lastSuccessfulSyncAt: Date | null | undefined,
  staleThresholdMs: number,
  now = new Date(),
): boolean {
  if (!lastSuccessfulSyncAt) {
    return false;
  }
  return now.getTime() - lastSuccessfulSyncAt.getTime() > staleThresholdMs;
}

/** PR-CMS-CONNECTOR-1E — effective health without running sync. */
export function evaluateOracleConnectorEffectiveHealth(input: {
  restEnabled: boolean;
  storedHealth: OracleSupplierConnectorHealth;
  lastSuccessfulSyncAt: Date | null;
  staleThresholdMs: number;
  now?: Date;
}): OracleSupplierConnectorHealth {
  if (!input.restEnabled) {
    return OracleSupplierConnectorHealth.DISABLED;
  }

  if (!input.lastSuccessfulSyncAt) {
    return input.storedHealth;
  }

  if (
    isConnectorSyncStale(
      input.lastSuccessfulSyncAt,
      input.staleThresholdMs,
      input.now,
    )
  ) {
    return OracleSupplierConnectorHealth.STALE;
  }

  return input.storedHealth;
}
