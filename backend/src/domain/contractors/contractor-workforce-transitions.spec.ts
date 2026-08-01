import { ContractorWorkforceState } from '@prisma/client';
import {
  CONTRACTOR_WORKFORCE_TRANSITIONS,
  resolveWorkforceDomainEvent,
} from './contractor-workforce-state.constants';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from './contractor-workforce-domain-events.constants';
import { ContractorWorkforceStateService } from './contractor-workforce-state.service';
import { InvalidContractorWorkforceTransitionException } from './contractor-workforce-state.errors';

describe('PR-WORKFORCE-TRANSITIONS-1 transition matrix', () => {
  const service = new ContractorWorkforceStateService(
    {} as never,
    {} as never,
    {} as never,
    {} as never,
    {} as never,
  );

  const allowedPairs: Array<[ContractorWorkforceState, ContractorWorkforceState]> = [
    [ContractorWorkforceState.NOMINATED, ContractorWorkforceState.PENDING_APPROVAL],
    [ContractorWorkforceState.NOMINATED, ContractorWorkforceState.REJECTED],
    [ContractorWorkforceState.NOMINATED, ContractorWorkforceState.BLACKLISTED],
    [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.ACTIVE],
    [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.NOMINATED],
    [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.REJECTED],
    [ContractorWorkforceState.PENDING_APPROVAL, ContractorWorkforceState.BLACKLISTED],
    [ContractorWorkforceState.REJECTED, ContractorWorkforceState.NOMINATED],
    [ContractorWorkforceState.REJECTED, ContractorWorkforceState.BLACKLISTED],
    [ContractorWorkforceState.ACTIVE, ContractorWorkforceState.SUSPENDED],
    [ContractorWorkforceState.SUSPENDED, ContractorWorkforceState.ACTIVE],
    [ContractorWorkforceState.ACTIVE, ContractorWorkforceState.TERMINATED],
    [ContractorWorkforceState.TERMINATED, ContractorWorkforceState.ACTIVE],
    [ContractorWorkforceState.ACTIVE, ContractorWorkforceState.BLACKLISTED],
    [ContractorWorkforceState.TERMINATED, ContractorWorkforceState.BLACKLISTED],
  ];

  it.each(allowedPairs)('allows %s → %s', (from, to) => {
    expect(() => service.assertTransitionAllowed(from, to)).not.toThrow();
    expect(CONTRACTOR_WORKFORCE_TRANSITIONS[from]).toContain(to);
  });

  it('blocks shortcut NOMINATED → ACTIVE', () => {
    expect(() =>
      service.assertTransitionAllowed(
        ContractorWorkforceState.NOMINATED,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toThrow(InvalidContractorWorkforceTransitionException);
  });

  it('blocks transitions out of BLACKLISTED', () => {
    expect(CONTRACTOR_WORKFORCE_TRANSITIONS[ContractorWorkforceState.BLACKLISTED]).toEqual([]);
  });

  it('maps TERMINATED → ACTIVE to rehire domain event', () => {
    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.TERMINATED,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REHIRED);
  });

  it('maps SUSPENDED → ACTIVE to reinstate domain event', () => {
    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.SUSPENDED,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REINSTATED);
  });
});
