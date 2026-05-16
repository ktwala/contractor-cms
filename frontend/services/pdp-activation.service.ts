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

// In a real application, this would use the configured Axios instance.
// Using fetch for the simulation.
const API_BASE = '/api/v1/pdp/activation';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export const pdpActivationService = {
  async listRules(): Promise<PdpActivationListResponse> {
    const res = await fetch(API_BASE, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch activation rules');
    return res.json();
  },

  async createRule(dto: Partial<PdpActivationRule>): Promise<PdpActivationRule> {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create rule');
    }
    return res.json();
  },

  async updateRule(id: string, dto: Partial<PdpActivationRule>): Promise<PdpActivationRule> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update rule');
    }
    return res.json();
  },

  async disableRule(id: string, notes?: string): Promise<PdpActivationRule> {
    const res = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to disable rule');
    }
    return res.json();
  },

  async previewEvaluation(dto: PreviewEvaluationDto): Promise<PreviewEvaluationResponse> {
    const res = await fetch(`${API_BASE}/preview`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to preview evaluation');
    }
    return res.json();
  }
};
