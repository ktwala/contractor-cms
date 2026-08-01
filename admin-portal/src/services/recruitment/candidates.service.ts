import api from '../api';

export type ApplicationApi = {
  id: string;
  requisitionId: string;
  stage: string;
  status: string;
  rating?: number | null;
  applicationDate?: string;
  requisition?: { id: string; title: string; status?: string };
};

/** Prisma/Nest JSON uses camelCase */
export type CandidateApi = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  skills?: unknown;
  status?: string;
  createdAt?: string;
  applications?: ApplicationApi[];
};

export const candidatesService = {
  list: async (legalEntityId?: string): Promise<CandidateApi[]> => {
    const res = await api.get<CandidateApi[]>('/api/recruitment/candidates', {
      params: legalEntityId?.trim() ? { legal_entity_id: legalEntityId.trim() } : {},
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  create: async (payload: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    source?: string;
    linkedin_url?: string;
    resume_url?: string;
    skills?: string[];
  }): Promise<{ candidate_id: string }> => {
    const res = await api.post<{ candidate_id: string }>('/api/recruitment/candidates', payload);
    return res.data;
  },

  applyToRequisition: async (payload: {
    candidate_id: string;
    requisition_id: string;
  }): Promise<{ application_id: string; candidate_id: string }> => {
    const res = await api.post<{ application_id: string; candidate_id: string }>('/api/recruitment/applications', {
      requisition_id: payload.requisition_id,
      candidate_id: payload.candidate_id,
    });
    return res.data;
  },

  moveStage: async (applicationId: string, stage: string): Promise<void> => {
    await api.post(`/api/recruitment/applications/${applicationId}/stage`, { stage });
  },

  reject: async (applicationId: string, rejection_reason: string): Promise<void> => {
    await api.post(`/api/recruitment/applications/${applicationId}/reject`, { rejection_reason });
  },

  rate: async (applicationId: string, overall_rating: number): Promise<void> => {
    await api.post(`/api/recruitment/applications/${applicationId}/rate`, {
      overall_rating,
      screening_score: null,
    });
  },
};
