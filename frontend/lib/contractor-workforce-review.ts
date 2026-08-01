import { formatWorkforceState } from './workforce-state';

export type ContractorPlacementIntent = {
  engagementId: string;
  role: string;
  startDate: string;
  endDate?: string | null;
  rateType: string;
  rateAmount: string;
  currency: string;
  responsibleManagerEmployeeId?: string | null;
  contractId: string;
  contractNumber: string;
  contractTitle: string;
};

export type ContractorWorkforceReviewQueueItem = {
  id: string;
  supplierId: string;
  firstName: string;
  lastName: string;
  email: string;
  workerClassification: string;
  engagementModel: string;
  workforceState: string;
  isActive: boolean;
  createdAt: string;
  supplierDisplayName: string;
  placementIntent?: ContractorPlacementIntent | null;
  canSubmitForReview: boolean;
  canActivate: boolean;
  canReject: boolean;
  canSendBack: boolean;
  canBlacklist: boolean;
  canReopen?: boolean;
  nextTargetState?: string | null;
};

export type ContractorWorkforceReviewQueueResponse = {
  data: ContractorWorkforceReviewQueueItem[];
  total: number;
};

export type OpsWorkforceActionKind = 'ADVANCE' | 'REJECT' | 'SEND_BACK' | 'REOPEN' | 'BLACKLIST';

export type OpsWorkforceAction = {
  kind: OpsWorkforceActionKind;
  targetState: string;
  label: string;
  description: string;
  buttonClass?: string;
  requiresAuthorityNote?: boolean;
};

export function opsReviewAdvanceAction(item: ContractorWorkforceReviewQueueItem): OpsWorkforceAction | null {
  if (!item.nextTargetState) return null;
  if (item.workforceState === 'NOMINATED' && item.canSubmitForReview) {
    return {
      kind: 'ADVANCE',
      targetState: item.nextTargetState,
      label: 'Submit for review',
      description: `Move to ${formatWorkforceState('PENDING_APPROVAL')} — ops review, not MTN approval workflow.`,
      buttonClass: 'btn-primary',
    };
  }
  if (item.workforceState === 'PENDING_APPROVAL' && item.canActivate) {
    return {
      kind: 'ADVANCE',
      targetState: item.nextTargetState,
      label: 'Activate',
      description: `Activate contractor (${formatWorkforceState('ACTIVE')}) — workforce plane only.`,
      buttonClass: 'btn-primary',
    };
  }
  if (item.workforceState === 'REJECTED' && item.canReopen) {
    return {
      kind: 'REOPEN',
      targetState: 'NOMINATED',
      label: 'Reopen nomination',
      description: 'Return nomination to supplier-visible NOMINATED for corrected resubmission.',
      buttonClass: 'btn-primary',
    };
  }
  return null;
}

export function opsReviewOutcomeActions(
  item: ContractorWorkforceReviewQueueItem,
): OpsWorkforceAction[] {
  const actions: OpsWorkforceAction[] = [];
  if (item.canSendBack) {
    actions.push({
      kind: 'SEND_BACK',
      targetState: 'NOMINATED',
      label: 'Send back',
      description: 'Return to supplier for correction — same contractor record and timeline.',
      buttonClass: 'btn-secondary',
    });
  }
  if (item.canReject) {
    actions.push({
      kind: 'REJECT',
      targetState: 'REJECTED',
      label: 'Reject',
      description: 'Close this nomination path — supplier sees Rejected with your reason.',
      buttonClass: 'btn-secondary',
    });
  }
  if (item.canBlacklist) {
    actions.push({
      kind: 'BLACKLIST',
      targetState: 'BLACKLISTED',
      label: 'Blacklist',
      description:
        'External workforce policy block — not MTN disciplinary approval. Requires reason and internal authority note.',
      buttonClass: 'btn-secondary',
      requiresAuthorityNote: true,
    });
  }
  return actions;
}

/** @deprecated use opsReviewAdvanceAction */
export function opsReviewActionLabel(item: ContractorWorkforceReviewQueueItem): string {
  return opsReviewAdvanceAction(item)?.label ?? 'Advance';
}

/** @deprecated use OpsWorkforceAction.description */
export function opsReviewActionDescription(item: ContractorWorkforceReviewQueueItem): string {
  return opsReviewAdvanceAction(item)?.description ?? 'Advance workforce state';
}

export type WorkforceHistoryEntry = {
  id: string;
  contractorId: string;
  fromState?: string | null;
  toState: string;
  transitionLabel: string;
  occurredAt: string;
  effectiveAt?: string | null;
  actorUserId?: string | null;
  reason?: string | null;
  source: string;
  metadata?: Record<string, unknown> | null;
};

export type ContractorWorkforceTimelineResponse = {
  data: WorkforceHistoryEntry[];
};

export function formatWorkforceHistorySource(source: string): string {
  return source.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export function parseWorkforceTransitionError(err: unknown): string {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  const message = data?.message;
  if (Array.isArray(message)) {
    return message.join(', ');
  }
  if (typeof message === 'string') {
    return message;
  }
  return 'Workforce transition failed';
}
