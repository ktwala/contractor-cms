import {
  ContractorAccessIntent,
  ResponsibleManagerAccountabilityStatus,
  ResponsibleManagerTaskType,
} from '@prisma/client';

export type EngagementForTaskSync = {
  id: string;
  contractorId: string;
  isActive: boolean;
  endDate: Date | null;
  responsibleManagerStatus: ResponsibleManagerAccountabilityStatus | null;
  contractor: {
    accessIntent: ContractorAccessIntent | null;
  };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function deriveResponsibleManagerTaskTypes(
  engagement: EngagementForTaskSync,
  now = new Date(),
): ResponsibleManagerTaskType[] {
  const types: ResponsibleManagerTaskType[] = [];
  const ended =
    !engagement.isActive ||
    (engagement.endDate !== null && engagement.endDate < now);

  if (ended) {
    types.push(ResponsibleManagerTaskType.OFFBOARDING_PROMPT);
    return types;
  }

  if (engagement.responsibleManagerStatus === ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED) {
    types.push(ResponsibleManagerTaskType.CERTIFICATION_READINESS);
  }

  const intent = engagement.contractor.accessIntent;
  if (
    intent &&
    intent !== ContractorAccessIntent.ACCESS_NONE
  ) {
    types.push(ResponsibleManagerTaskType.ACCESS_NEED_CONFIRMATION);
  }

  if (engagement.endDate) {
    const daysUntilEnd =
      (engagement.endDate.getTime() - now.getTime()) / MS_PER_DAY;
    if (daysUntilEnd >= 0 && daysUntilEnd <= 30) {
      types.push(ResponsibleManagerTaskType.RENEWAL_REVIEW);
    }
  }

  return types;
}

export function taskTitleForType(type: ResponsibleManagerTaskType): string {
  switch (type) {
    case ResponsibleManagerTaskType.ACCESS_NEED_CONFIRMATION:
      return 'Confirm access need';
    case ResponsibleManagerTaskType.CERTIFICATION_READINESS:
      return 'Certify sponsor accountability';
    case ResponsibleManagerTaskType.RENEWAL_REVIEW:
      return 'Review engagement renewal';
    case ResponsibleManagerTaskType.OFFBOARDING_PROMPT:
      return 'Confirm offboarding';
    default:
      return 'Sponsor accountability task';
  }
}

export function taskDescriptionForType(type: ResponsibleManagerTaskType): string {
  switch (type) {
    case ResponsibleManagerTaskType.ACCESS_NEED_CONFIRMATION:
      return 'Confirm whether the contractor still requires the indicated access for this placement.';
    case ResponsibleManagerTaskType.CERTIFICATION_READINESS:
      return 'Attest that you are the accountable business sponsor for this engagement.';
    case ResponsibleManagerTaskType.RENEWAL_REVIEW:
      return 'Review whether this engagement should be renewed before the end date.';
    case ResponsibleManagerTaskType.OFFBOARDING_PROMPT:
      return 'Confirm offboarding steps and that access should end for this placement.';
    default:
      return '';
  }
}
