import { HcmOracleConnectorHealth } from '@prisma/client';
import {
  evaluateHcmConnectorEffectiveHealth,
  healthFromHcmUpstreamCode,
  isHcmConnectorSyncStale,
} from '../oracle-hcm-health.util';

describe('oracle-hcm-health.util (PR-CTR-CONNECTOR-1D)', () => {
  const thresholdMs = 24 * 60 * 60 * 1000;
  const now = new Date('2026-05-19T12:00:00.000Z');

  describe('healthFromHcmUpstreamCode', () => {
    it('maps upstream codes to connector health enums', () => {
      expect(healthFromHcmUpstreamCode('AUTH_FAILED')).toBe(
        HcmOracleConnectorHealth.AUTH_FAILED,
      );
      expect(healthFromHcmUpstreamCode('RATE_LIMITED')).toBe(
        HcmOracleConnectorHealth.RATE_LIMITED,
      );
      expect(healthFromHcmUpstreamCode('UPSTREAM_ERROR')).toBe(
        HcmOracleConnectorHealth.DEGRADED,
      );
    });
  });

  describe('isHcmConnectorSyncStale', () => {
    it('returns false when no prior successful REST sync', () => {
      expect(isHcmConnectorSyncStale(null, thresholdMs, now)).toBe(false);
    });

    it('returns true when last sync is older than threshold', () => {
      const last = new Date(now.getTime() - thresholdMs - 1);
      expect(isHcmConnectorSyncStale(last, thresholdMs, now)).toBe(true);
    });
  });

  describe('evaluateHcmConnectorEffectiveHealth', () => {
    it('returns DISABLED when REST is disabled', () => {
      expect(
        evaluateHcmConnectorEffectiveHealth({
          restEnabled: false,
          storedHealth: HcmOracleConnectorHealth.HEALTHY,
          lastSuccessfulSyncAt: new Date(),
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(HcmOracleConnectorHealth.DISABLED);
    });

    it('returns UNKNOWN when REST enabled and no successful sync yet', () => {
      expect(
        evaluateHcmConnectorEffectiveHealth({
          restEnabled: true,
          storedHealth: HcmOracleConnectorHealth.UNKNOWN,
          lastSuccessfulSyncAt: null,
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(HcmOracleConnectorHealth.UNKNOWN);
    });

    it('returns STALE without running sync when last success is too old', () => {
      const staleAt = new Date(now.getTime() - thresholdMs - 1);
      expect(
        evaluateHcmConnectorEffectiveHealth({
          restEnabled: true,
          storedHealth: HcmOracleConnectorHealth.HEALTHY,
          lastSuccessfulSyncAt: staleAt,
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(HcmOracleConnectorHealth.STALE);
    });

    it('returns persisted failure health when not stale', () => {
      expect(
        evaluateHcmConnectorEffectiveHealth({
          restEnabled: true,
          storedHealth: HcmOracleConnectorHealth.AUTH_FAILED,
          lastSuccessfulSyncAt: new Date(now.getTime() - 60_000),
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(HcmOracleConnectorHealth.AUTH_FAILED);
    });
  });
});
