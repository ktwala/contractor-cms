import {
  ContractorAccessIntent,
  ResponsibleManagerAccountabilityStatus,
  ResponsibleManagerTaskType,
} from '@prisma/client';
import { deriveResponsibleManagerTaskTypes } from './responsible-manager-task-sync';

describe('deriveResponsibleManagerTaskTypes', () => {
  const now = new Date('2026-05-16T12:00:00.000Z');

  const base = {
    id: 'e1',
    contractorId: 'c1',
    isActive: true,
    endDate: null as Date | null,
    responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
    contractor: { accessIntent: ContractorAccessIntent.ACCESS_NONE },
  };

  it('includes certification when sponsor is assigned', () => {
    expect(deriveResponsibleManagerTaskTypes(base, now)).toContain(
      ResponsibleManagerTaskType.CERTIFICATION_READINESS,
    );
  });

  it('includes access confirmation when access intent is set', () => {
    const types = deriveResponsibleManagerTaskTypes(
      {
        ...base,
        contractor: { accessIntent: ContractorAccessIntent.ACCESS_LOGICAL },
      },
      now,
    );
    expect(types).toContain(ResponsibleManagerTaskType.ACCESS_NEED_CONFIRMATION);
  });

  it('includes renewal when end date within 30 days', () => {
    const types = deriveResponsibleManagerTaskTypes(
      {
        ...base,
        endDate: new Date('2026-06-01T00:00:00.000Z'),
      },
      now,
    );
    expect(types).toContain(ResponsibleManagerTaskType.RENEWAL_REVIEW);
  });

  it('offboarding only when engagement ended', () => {
    const types = deriveResponsibleManagerTaskTypes(
      {
        ...base,
        isActive: false,
      },
      now,
    );
    expect(types).toEqual([ResponsibleManagerTaskType.OFFBOARDING_PROMPT]);
  });
});
