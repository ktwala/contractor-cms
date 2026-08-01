import { BadRequestException } from '@nestjs/common';
import { ContractorWorkforceState } from '@prisma/client';
import {
  assertWorkforceTransitionAuthorityNote,
  assertWorkforceTransitionReason,
  buildWorkforceBlacklistHistoryMetadata,
  canTransitionToBlacklisted,
} from './contractor-workforce-state.constants';
import { deriveWorkforceTransitionLabel } from './contractor-workforce-history.constants';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from './contractor-workforce-domain-events.constants';
import { resolveWorkforceDomainEvent } from './contractor-workforce-state.constants';

describe('PR-WORKFORCE-BLACKLIST-1', () => {
  it('allows blacklist from nominated, review, rejected, active, and terminated', () => {
    for (const from of [
      ContractorWorkforceState.NOMINATED,
      ContractorWorkforceState.PENDING_APPROVAL,
      ContractorWorkforceState.REJECTED,
      ContractorWorkforceState.ACTIVE,
      ContractorWorkforceState.TERMINATED,
    ]) {
      expect(canTransitionToBlacklisted(from)).toBe(true);
    }
    expect(canTransitionToBlacklisted(ContractorWorkforceState.SUSPENDED)).toBe(false);
  });

  it('requires reason and authority note for blacklist transitions', () => {
    expect(() =>
      assertWorkforceTransitionReason(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.BLACKLISTED,
        undefined,
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      assertWorkforceTransitionAuthorityNote(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.BLACKLISTED,
        '   ',
      ),
    ).toThrow(BadRequestException);

    expect(() =>
      assertWorkforceTransitionReason(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.BLACKLISTED,
        'Policy breach confirmed',
      ),
    ).not.toThrow();

    expect(() =>
      assertWorkforceTransitionAuthorityNote(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.BLACKLISTED,
        'Ops director approval ref OPS-2026-14',
      ),
    ).not.toThrow();
  });

  it('builds internal blacklist history metadata', () => {
    expect(buildWorkforceBlacklistHistoryMetadata('Ops director approval ref OPS-2026-14')).toEqual({
      authorityNote: 'Ops director approval ref OPS-2026-14',
      workforceBlock: true,
    });
  });

  it('derives Blacklisted label and domain stub', () => {
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.BLACKLISTED,
      ),
    ).toBe('Blacklisted');

    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.BLACKLISTED,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.BLACKLISTED);
  });
});
