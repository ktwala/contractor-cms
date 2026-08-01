import { EvidenceChecklistResult } from './supplier-evidence';

export type SupplierEvidenceSummaryStatus = 'COMPLETE' | 'INCOMPLETE' | 'EXPIRED';

export interface SupplierApprovalQueueItem {
  id: string;
  type: string;
  status: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  tradingName?: string;
  email: string;
  phone?: string;
  country: string;
  evidenceStatus: SupplierEvidenceSummaryStatus;
  evidenceComplete: boolean;
  evidenceNote?: string;
  missingCount: number;
  expiredCount: number;
  canApprove: boolean;
  waitingFor: string;
  createdAt: string;
}

export interface SupplierApprovalQueueResponse {
  data: SupplierApprovalQueueItem[];
  total: number;
}

export function evidenceSummaryLabel(status: SupplierEvidenceSummaryStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'Complete';
    case 'EXPIRED':
      return 'Expired';
    default:
      return 'Incomplete';
  }
}

export function evidenceSummaryClass(status: SupplierEvidenceSummaryStatus): string {
  switch (status) {
    case 'COMPLETE':
      return 'bg-green-100 text-green-800';
    case 'EXPIRED':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-amber-100 text-amber-800';
  }
}

export type SupplierTransitionError = {
  message: string;
  code?: string;
  checklist?: EvidenceChecklistResult;
};

export function parseSupplierTransitionError(err: unknown): SupplierTransitionError {
  const data = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
  const message = data?.message;
  const text = Array.isArray(message)
    ? message.join(', ')
    : typeof message === 'string'
      ? message
      : 'Action failed';

  return {
    message: text,
    code: typeof data?.code === 'string' ? data.code : undefined,
    checklist:
      data?.checklist && typeof data.checklist === 'object'
        ? (data.checklist as EvidenceChecklistResult)
        : undefined,
  };
}
