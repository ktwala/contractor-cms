import { OracleSupplierConnectorHealth } from '@prisma/client';
import {
  evaluateOracleConnectorEffectiveHealth,
  healthFromUpstreamCode,
  isConnectorSyncStale,
} from '../oracle-procurement-health.util';

describe('oracle-procurement-health.util (PR-CMS-CONNECTOR-1D–1E)', () => {
  const thresholdMs = 24 * 60 * 60 * 1000;
  const now = new Date('2026-05-19T12:00:00.000Z');

  describe('healthFromUpstreamCode', () => {
    it('maps upstream codes to connector health enums', () => {
      expect(healthFromUpstreamCode('AUTH_FAILED')).toBe(
        OracleSupplierConnectorHealth.AUTH_FAILED,
      );
      expect(healthFromUpstreamCode('RATE_LIMITED')).toBe(
        OracleSupplierConnectorHealth.RATE_LIMITED,
      );
      expect(healthFromUpstreamCode('UPSTREAM_ERROR')).toBe(
        OracleSupplierConnectorHealth.DEGRADED,
      );
    });
  });

  describe('isConnectorSyncStale', () => {
    it('returns false when no prior successful sync', () => {
      expect(isConnectorSyncStale(null, thresholdMs, now)).toBe(false);
    });

    it('returns true when last sync is older than threshold', () => {
      const last = new Date(now.getTime() - thresholdMs - 1);
      expect(isConnectorSyncStale(last, thresholdMs, now)).toBe(true);
    });

    it('returns false when last sync is within threshold', () => {
      const last = new Date(now.getTime() - thresholdMs + 60_000);
      expect(isConnectorSyncStale(last, thresholdMs, now)).toBe(false);
    });
  });

  describe('evaluateOracleConnectorEffectiveHealth', () => {
    it('returns DISABLED when REST is disabled', () => {
      expect(
        evaluateOracleConnectorEffectiveHealth({
          restEnabled: false,
          storedHealth: OracleSupplierConnectorHealth.HEALTHY,
          lastSuccessfulSyncAt: new Date(),
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(OracleSupplierConnectorHealth.DISABLED);
    });

    it('returns UNKNOWN when REST enabled and no successful sync yet', () => {
      expect(
        evaluateOracleConnectorEffectiveHealth({
          restEnabled: true,
          storedHealth: OracleSupplierConnectorHealth.UNKNOWN,
          lastSuccessfulSyncAt: null,
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(OracleSupplierConnectorHealth.UNKNOWN);
    });

    it('returns STALE without running sync when last success is too old', () => {
      const staleAt = new Date(now.getTime() - thresholdMs - 1);
      expect(
        evaluateOracleConnectorEffectiveHealth({
          restEnabled: true,
          storedHealth: OracleSupplierConnectorHealth.HEALTHY,
          lastSuccessfulSyncAt: staleAt,
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(OracleSupplierConnectorHealth.STALE);
    });

    it('returns persisted failure health when not stale', () => {
      expect(
        evaluateOracleConnectorEffectiveHealth({
          restEnabled: true,
          storedHealth: OracleSupplierConnectorHealth.AUTH_FAILED,
          lastSuccessfulSyncAt: new Date(now.getTime() - 60_000),
          staleThresholdMs: thresholdMs,
          now,
        }),
      ).toBe(OracleSupplierConnectorHealth.AUTH_FAILED);
    });
  });
});
