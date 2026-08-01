import { api } from '@/lib/api';

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

export const pdpExceptionService = {
  async listExceptions(status?: string): Promise<PdpExceptionRequest[]> {
    try {
      return (await api.listPdpExceptions(status)) as PdpExceptionRequest[];
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to fetch exceptions'));
    }
  },

  async createException(dto: CreateExceptionDto): Promise<PdpExceptionRequest> {
    try {
      return (await api.createPdpException(dto)) as PdpExceptionRequest;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to create exception request'));
    }
  },

  async approveException(id: string, notes: string, expiresAt: string): Promise<PdpExceptionRequest> {
    try {
      return (await api.approvePdpException(id, notes, expiresAt)) as PdpExceptionRequest;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to approve exception'));
    }
  },

  async rejectException(id: string, notes: string): Promise<PdpExceptionRequest> {
    try {
      return (await api.rejectPdpException(id, notes)) as PdpExceptionRequest;
    } catch (err) {
      throw new Error(formatApiError(err, 'Failed to reject exception'));
    }
  },
};
