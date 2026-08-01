import api from '../api';

export type InterviewApi = {
  id: string;
  application_id?: string | null;
  candidate_name?: string;
  requisition_title?: string;
  interview_type?: string;
  scheduled_date?: string;
  duration?: number;
  location?: string | null;
  meeting_link?: string | null;
  interviewer_ids?: string[];
  status?: string;
  current_user_has_feedback?: boolean;
};

export const interviewsService = {
  list: async (legalEntityId: string): Promise<InterviewApi[]> => {
    const res = await api.get<InterviewApi[]>('/api/recruitment/interviews', {
      params: { legal_entity_id: legalEntityId },
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  myInterviews: async (status?: string): Promise<InterviewApi[]> => {
    const res = await api.get<InterviewApi[]>('/api/recruitment/interviews/my-interviews', {
      params: status ? { status } : {},
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  schedule: async (payload: {
    application_id: string;
    interview_type: string;
    scheduled_date: string;
    duration_minutes?: number;
    interviewer_id: string;
    location?: string;
    video_meeting_link?: string;
    /** Extra panel members (stored with primary interviewer). */
    additional_interviewers?: string[];
  }): Promise<{ interview_id: string }> => {
    const res = await api.post<{ interview_id: string }>('/api/recruitment/interviews', payload);
    return res.data;
  },

  feedback: async (
    interviewId: string,
    body: { overall_rating: number; recommendation: string; detailed_feedback?: string },
  ): Promise<void> => {
    await api.post(`/api/recruitment/interviews/${interviewId}/feedback`, body);
  },

  complete: async (id: string): Promise<void> => {
    await api.post(`/api/recruitment/interviews/${id}/complete`);
  },

  cancel: async (id: string, cancelled_reason: string): Promise<void> => {
    await api.post(`/api/recruitment/interviews/${id}/cancel`, { cancelled_reason });
  },
};
