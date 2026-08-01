import { api } from '@/lib/api';

export interface PdpActivationRule {
  id: string;
  reasonCode?: string;
  action?: string;
  domain?: string;
  organizationId?: string;
  environment: string;
  enforcementLevel: string;
  isActive: boolean;
  rolloutPercent: number;
  priority: number;
  expiresAt?: string;
  notes?: string;
  updatedBy: string;
  approvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PdpActivationListResponse {
  rules: PdpActivationRule[];
  isEmergencyOverrideActive: boolean;
}

export interface PreviewEvaluationDto {
  action: string;
  organizationId?: string;
  supplierId: string;
  contractorId?: string;
  poId?: string;
  timesheetId?: string;
  invoiceId?: string;
  transactionDate: string;
}

export interface PreviewEvaluationResponse {
  decision: string;
  reason_code?: string;
  message?: string;
  effectiveDecision: string;
  evaluatedDecision: string;
  isShadow: boolean;
}

function formatApiError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'response' in err) {
    const data = (err as { response?: { data?: { message?: string | string[] } } }).response?.data;
    const message = data?.message;
    if (Array.isArray(message)) return message.join(', ');
    if (typeof message === 'string' && message.trim()) return message;
  }
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export const pdpActivationService = {
  async listRules(): Promise<PdpActivationListResponse> {
    try {
      return (await api.listPdpActivationRules()) as PdpActivationListResponse;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to fetch activation rules'));
    }
  },

  async createRule(dto: Partial<PdpActivationRule>): Promise<PdpActivationRule> {
    try {
      return (await api.createPdpActivationRule(dto)) as PdpActivationRule;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to create rule'));
    }
  },

  async updateRule(id: string, dto: Partial<PdpActivationRule>): Promise<PdpActivationRule> {
    try {
      return (await api.updatePdpActivationRule(id, dto)) as PdpActivationRule;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to update rule'));
    }
  },

  async disableRule(id: string, notes?: string): Promise<PdpActivationRule> {
    try {
      return (await api.disablePdpActivationRule(id, notes)) as PdpActivationRule;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to disable rule'));
    }
  },

  async previewEvaluation(dto: PreviewEvaluationDto): Promise<PreviewEvaluationResponse> {
    try {
      return (await api.previewPdpEvaluation(dto)) as PreviewEvaluationResponse;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to preview evaluation'));
    }
  },
};
