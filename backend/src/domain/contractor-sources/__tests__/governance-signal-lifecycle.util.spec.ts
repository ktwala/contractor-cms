import { ContractorSourceDriftType, GovernanceSignalCategory } from '@prisma/client';
import {
  buildOperationalDriftVisibilityWhere,
  classifyContractorDriftSignal,
  isPastWorkforceCutover,
  resolveBootstrapExpiresAt,
} from '../governance-signal-lifecycle.util';

describe('governance-signal-lifecycle.util', () => {
  it('classifies unsponsored as OPERATIONAL', () => {
    const c = classifyContractorDriftSignal(
      ContractorSourceDriftType.MISSING_RESPONSIBLE_MANAGER,
    );
    expect(c.signalCategory).toBe(GovernanceSignalCategory.OPERATIONAL);
    expect(c.suppressAfterCutover).toBe(false);
  });

  it('classifies correlation conflict as BOOTSTRAP with cutover suppress', () => {
    const c = classifyContractorDriftSignal(
      ContractorSourceDriftType.PERSON_CORRELATION_CONFLICT,
    );
    expect(c.signalCategory).toBe(GovernanceSignalCategory.BOOTSTRAP);
    expect(c.suppressAfterCutover).toBe(true);
  });

  it('sets bootstrap expiresAt 30 days from detection', () => {
    const detected = new Date('2026-01-01T00:00:00.000Z');
    const expires = resolveBootstrapExpiresAt(detected);
    expect(expires.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  it('hides suppressed bootstrap after cutover when operationalOnly', () => {
    const past = new Date('2020-01-01');
    expect(isPastWorkforceCutover({ workforceMigrationCutoverAt: past })).toBe(true);
    const where = buildOperationalDriftVisibilityWhere('org-1', {
      workforceMigrationCutoverAt: past,
    }, true);
    expect(where.OR).toBeDefined();
  });
});
