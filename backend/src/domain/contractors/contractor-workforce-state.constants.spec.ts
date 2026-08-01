import { ContractorWorkforceState } from '@prisma/client';
import {
  deriveIsActiveFromWorkforceState,
  resolveWorkforceDomainEvent,
} from './contractor-workforce-state.constants';
import { CONTRACTOR_WORKFORCE_DOMAIN_EVENTS } from './contractor-workforce-domain-events.constants';

describe('contractor-workforce-state.constants', () => {
  it('deriveIsActiveFromWorkforceState is true only for ACTIVE', () => {
    expect(deriveIsActiveFromWorkforceState(ContractorWorkforceState.ACTIVE)).toBe(true);
    expect(deriveIsActiveFromWorkforceState(ContractorWorkforceState.SUSPENDED)).toBe(false);
    expect(deriveIsActiveFromWorkforceState(ContractorWorkforceState.TERMINATED)).toBe(false);
  });

  it('resolveWorkforceDomainEvent maps termination and rehire', () => {
    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.ACTIVE,
        ContractorWorkforceState.TERMINATED,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.TERMINATED);

    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.TERMINATED,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REHIRED);

    expect(
      resolveWorkforceDomainEvent(
        ContractorWorkforceState.SUSPENDED,
        ContractorWorkforceState.ACTIVE,
      ),
    ).toBe(CONTRACTOR_WORKFORCE_DOMAIN_EVENTS.REINSTATED);
  });
});
