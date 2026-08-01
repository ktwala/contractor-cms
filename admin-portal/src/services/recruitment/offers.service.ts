import api from '../api';

export type OfferApi = {
  id: string;
  offer_number?: string;
  candidate_name?: string;
  requisition_title?: string;
  position?: string;
  base_salary?: string;
  currency?: string;
  status?: string;
  expiry_date?: string;
  sent_at?: string;
  offer_letter_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

export const offersService = {
  list: async (legalEntityId?: string): Promise<OfferApi[]> => {
    const res = await api.get<OfferApi[]>('/api/recruitment/offers', {
      params: legalEntityId?.trim() ? { legal_entity_id: legalEntityId.trim() } : {},
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  create: async (payload: {
    application_id: string;
    salary: number;
    offer_expiry_date: string;
    job_title?: string;
    start_date?: string;
    salary_currency?: string;
    benefits_summary?: string;
    signing_bonus?: number;
    offer_letter_url?: string;
  }): Promise<{ offer_id: string }> => {
    const res = await api.post<{ offer_id: string }>('/api/recruitment/offers', payload);
    return res.data;
  },

  approve: async (id: string): Promise<void> => {
    await api.post(`/api/recruitment/offers/${id}/approve`);
  },

  send: async (id: string, offer_letter_path: string): Promise<void> => {
    await api.post(`/api/recruitment/offers/${id}/send`, { offer_letter_path: offer_letter_path || ' ' });
  },
};
