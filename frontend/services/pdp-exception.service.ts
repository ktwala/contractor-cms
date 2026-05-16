export interface PdpExceptionRequest {
  id: string;
  evaluationId: string;
  reasonCode: string;
  action: string;
  contextTargetId?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  requestedBy: string;
  justification: string;
  approverId?: string;
  approvalNotes?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateExceptionDto {
  evaluationId: string;
  reasonCode: string;
  action: string;
  contextTargetId?: string;
  justification: string;
}

const API_BASE = '/api/v1/pdp/exceptions';

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export const pdpExceptionService = {
  async listExceptions(status?: string): Promise<PdpExceptionRequest[]> {
    const url = status ? `${API_BASE}?status=${status}` : API_BASE;
    const res = await fetch(url, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Failed to fetch exceptions');
    return res.json();
  },

  async createException(dto: CreateExceptionDto): Promise<PdpExceptionRequest> {
    const res = await fetch(API_BASE, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(dto)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to create exception request');
    }
    return res.json();
  },

  async approveException(id: string, notes: string, expiresAt: string): Promise<PdpExceptionRequest> {
    const res = await fetch(`${API_BASE}/${id}/approve`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ approvalNotes: notes, expiresAt })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to approve exception');
    }
    return res.json();
  },

  async rejectException(id: string, notes: string): Promise<PdpExceptionRequest> {
    const res = await fetch(`${API_BASE}/${id}/reject`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ approvalNotes: notes })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to reject exception');
    }
    return res.json();
  }
};
