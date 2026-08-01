import api from '../api';

/** Raw API row (snake_case from backend serializer) */
export type RequisitionApiRow = {
  id: string;
  requisition_number?: string;
  title: string;
  department?: string | null;
  legal_entity_id?: string | null;
  hiring_manager_id?: string | null;
  work_location_id?: string | null;
  hybrid?: boolean | null;
  description?: string | null;
  salary_min?: string | null;
  salary_max?: string | null;
  employment_type?: string | null;
  location?: string | null;
  remote?: boolean | null;
  positions?: number;
  filled_positions?: number;
  status: string;
  published_at?: string | null;
  application_count?: number;
  created_at?: string;
  updated_at?: string;
};

export type CreateRequisitionPayload = {
  legal_entity_id: string;
  job_title: string;
  department?: string;
  location?: string;
  employment_type?: string;
  number_of_positions?: number;
  salary_range_min?: number;
  salary_range_max?: number;
  job_description?: string;
  hiring_manager_id?: string;
  work_location_id?: string;
  hybrid?: boolean;
  remote_allowed?: boolean;
};

export const requisitionsService = {
  list: async (legalEntityId: string): Promise<RequisitionApiRow[]> => {
    const res = await api.get<RequisitionApiRow[]>('/api/recruitment/requisitions', {
      params: { legal_entity_id: legalEntityId },
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  get: async (id: string): Promise<RequisitionApiRow> => {
    const res = await api.get<RequisitionApiRow>(`/api/recruitment/requisitions/${id}`);
    return res.data;
  },

  create: async (payload: CreateRequisitionPayload): Promise<{ requisition_id: string }> => {
    const res = await api.post<{ requisition_id: string }>('/api/recruitment/requisitions', {
      ...payload,
      requirements: payload.job_description ?? '—',
      responsibilities: payload.job_description ?? '—',
    });
    return res.data;
  },

  update: async (id: string, payload: Record<string, unknown>): Promise<void> => {
    await api.put(`/api/recruitment/requisitions/${id}`, payload);
  },

  approve: async (id: string): Promise<void> => {
    await api.post(`/api/recruitment/requisitions/${id}/approve`);
  },

  post: async (id: string): Promise<void> => {
    await api.post(`/api/recruitment/requisitions/${id}/post`);
  },

  close: async (id: string, status: 'filled' | 'cancelled' | 'closed'): Promise<void> => {
    await api.post(`/api/recruitment/requisitions/${id}/close`, { status });
  },
};
