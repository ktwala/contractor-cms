import { BadRequestException } from '@nestjs/common';
import { ContractorWorkforceState } from '@prisma/client';
import {
  assertWorkforceTransitionReason,
  requiresWorkforceTransitionReason,
} from './contractor-workforce-state.constants';
import { deriveWorkforceTransitionLabel } from './contractor-workforce-history.constants';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from './contractor-workforce-domain-events.constants';
import { resolveWorkforceDomainEvent } from './contractor-workforce-state.constants';

describe('PR-WORKFORCE-REVIEW-OUTCOMES-1', () => {
  it('requires reason for reject, send-back, and reopen transitions', () => {
    const requiringReason: Array<[ContractorWorkforceState, ContractorWorkforceState]> = [
      [ContractorWorkforceState.NOMINATED, ContractorWorkforceState.REJECTED],
      [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.REJECTED],
      [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.NOMINATED],
      [ContractorWorkforceState.REJECTED, ContractorWorkforceState.NOMINATED],
    ];

    for (const [from, to] of requiringReason) {
      expect(requiresWorkforceTransitionReason(from, to)).toBe(true);
      expect(() => assertWorkforceTransitionReason(from, to, '   ')).toThrow(BadRequestException);
      expect(() => assertWorkforceTransitionReason(from, to, 'Incomplete placement details')).not.toThrow();
    }

    expect(
      requiresWorkforceTransitionReason(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.PENDING_APPROVAL,
      ),
    ).toBe(false);
  });

  it('derives review outcome timeline labels', () => {
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.REJECTED,
      ),
    ).toBe('Rejected');
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.PENDING_APPROVAL,
        ContractorWorkforceState.NOMINATED,
      ),
    ).toBe('Returned to supplier');
    expect(
      deriveWorkforceTransitionLabel(
        ContractorWorkforceState.REJECTED,
        ContractorWorkforceState.NOMINATED,
      ),
    ).toBe('Reopened nomination');
  });

  it('maps review outcomes to domain event stubs', () => {
    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.REJECTED,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REJECTED);
    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.REJECTED,
        ContractorWorkforceState.NOMINATED,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATION_REOPENED);
    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.PENDING_APPROVAL,
        ContractorWorkforceState.NOMINATED,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.NOMINATED);
  });
});
