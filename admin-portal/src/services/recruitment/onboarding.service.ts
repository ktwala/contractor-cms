import api from '../api';

export type OnboardingListRow = {
  id: string;
  employee_id?: string;
  employee_name?: string | null;
  workflow_name?: string;
  start_date?: string;
  status?: string;
  progress?: number;
  tasks_count?: number;
  documents_count?: number;
  candidate_name?: string | null;
  offer_id?: string | null;
  offer_status?: string | null;
  requisition_title?: string | null;
  requisition_department?: string | null;
  offer_position?: string | null;
  hiring_manager_name?: string | null;
};

export type OnboardingDetail = {
  id: string;
  employeeId?: string;
  employee_name?: string | null;
  employee_number?: string | null;
  candidate_id?: string | null;
  candidate_name?: string | null;
  offer_id?: string | null;
  offer_status?: string | null;
  requisition_title?: string | null;
  requisition_department?: string | null;
  offer_position?: string | null;
  hiring_manager_name?: string | null;
  /** Count of payroll Employment rows for this employee */
  payroll_employment_count?: number;
  workflowName?: string;
  startDate?: string;
  status?: string;
  progress?: number;
  tasks?: Array<{
    id: string;
    taskName: string;
    status: string;
    dueDate?: string | null;
    completedAt?: string | null;
  }>;
  documents?: Array<{
    id: string;
    documentType: string;
    documentName: string;
    status: string;
    fileUrl?: string | null;
    uploadedAt?: string | null;
    verifiedAt?: string | null;
  }>;
};

export const onboardingRecruitmentService = {
  list: async (legalEntityId?: string): Promise<OnboardingListRow[]> => {
    const res = await api.get<OnboardingListRow[]>('/api/recruitment/onboarding', {
      params: legalEntityId?.trim() ? { legal_entity_id: legalEntityId.trim() } : {},
    });
    return Array.isArray(res.data) ? res.data : [];
  },

  get: async (workflowId: string): Promise<OnboardingDetail> => {
    const res = await api.get<OnboardingDetail>(`/api/recruitment/onboarding/${workflowId}`);
    return res.data;
  },

  create: async (payload: {
    offer_id?: string;
    application_id?: string;
    employee_id?: string;
    start_date: string;
    workflow_name?: string;
    legal_entity_id?: string;
    assigned_buddy_id?: string;
    notes?: string;
    template_id?: string;
    workflow_template?: string;
  }): Promise<{
    workflow_id: string;
    employee_id?: string;
    employee_name?: string;
    candidate_id?: string;
    offer_id?: string;
    offer_status?: string;
    requisition_title?: string;
    department?: string | null;
    hiring_manager_name?: string | null;
    employment_record_created?: boolean;
    employment_setup_required?: boolean;
    employment_setup_reason?: string | null;
  }> => {
    const body = {
      ...payload,
      template_id: payload.template_id ?? payload.workflow_template,
    };
    const { workflow_template: _wt, ...rest } = body;
    const res = await api.post('/api/recruitment/onboarding', rest);
    return res.data;
  },

  completeTask: async (taskId: string, notes?: string): Promise<void> => {
    await api.post(`/api/recruitment/onboarding/tasks/${taskId}/complete`, { notes: notes ?? null });
  },

  addDocument: async (
    workflowId: string,
    body: { document_type: string; document_name: string; is_required?: boolean },
  ): Promise<void> => {
    await api.post(`/api/recruitment/onboarding/${workflowId}/documents`, body);
  },

  uploadDocument: async (documentId: string, file_path: string): Promise<void> => {
    await api.post(`/api/recruitment/onboarding/documents/${documentId}/upload`, { file_path });
  },

  verifyDocument: async (documentId: string): Promise<void> => {
    await api.post(`/api/recruitment/onboarding/documents/${documentId}/verify`);
  },
};
