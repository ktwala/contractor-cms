import api from '../api';
import type { AsyncEntityOption } from '../../components/selectors/AsyncEntitySelect';

export const lookupsService = {
  async searchUsers(params?: { query?: string; legalEntityId?: string }): Promise<AsyncEntityOption[]> {
    const res = await api.get<Array<{ id: string; name: string; email?: string }>>('/api/recruitment/users/options', {
      params: {
        search: params?.query ?? '',
        legal_entity_id: params?.legalEntityId,
      },
    });
    return (res.data ?? []).map((u) => ({
      id: u.id,
      label: u.name,
      subtitle: u.email,
    }));
  },

  async searchApplications(params?: {
    query?: string;
    legalEntityId?: string;
    candidateId?: string;
    allowedStages?: string[];
  }): Promise<AsyncEntityOption[]> {
    const stageParam =
      params?.allowedStages && params.allowedStages.length
        ? params.allowedStages.join(',')
        : undefined;
    const res = await api.get<
      Array<{
        id: string;
        candidate_name: string;
        requisition_title: string;
        stage: string;
        candidate_id?: string;
      }>
    >('/api/recruitment/applications/options', {
      params: {
        search: params?.query ?? '',
        legal_entity_id: params?.legalEntityId,
        candidate_id: params?.candidateId,
        stage: stageParam,
      },
    });
    return (res.data ?? []).map((app) => ({
      id: app.id,
      label: `${app.candidate_name} — ${app.requisition_title}`,
      subtitle: app.stage,
      meta: { candidateId: app.candidate_id, stage: app.stage },
    }));
  },

  async searchDepartments(params?: { query?: string; legalEntityId?: string }): Promise<AsyncEntityOption[]> {
    const res = await api.get<Array<{ id: string; name: string; code?: string }>>('/api/recruitment/org-units/options', {
      params: {
        search: params?.query ?? '',
        legal_entity_id: params?.legalEntityId,
      },
    });
    return (res.data ?? []).map((d) => ({
      id: d.id,
      label: d.name,
      subtitle: d.code,
      meta: { name: d.name, code: d.code },
    }));
  },

  async searchEmployees(params?: { query?: string; legalEntityId?: string }): Promise<AsyncEntityOption[]> {
    const res = await api.get<
      Array<{ id: string; name: string; email?: string | null; employee_number?: string; job_title?: string | null }>
    >('/api/recruitment/employees/options', {
      params: {
        search: params?.query ?? '',
        legal_entity_id: params?.legalEntityId,
      },
    });
    return (res.data ?? []).map((e) => ({
      id: e.id,
      label: e.name,
      subtitle: [e.job_title, e.employee_number].filter(Boolean).join(' • ') || e.email || undefined,
    }));
  },

  async searchWorkLocations(params?: { query?: string; legalEntityId?: string }): Promise<AsyncEntityOption[]> {
    const res = await api.get<
      Array<{
        id: string;
        name: string;
        code?: string;
        city?: string | null;
        country_code?: string | null;
        is_remote?: boolean;
        is_hybrid?: boolean;
      }>
    >('/api/recruitment/work-locations/options', {
      params: {
        search: params?.query ?? '',
        legal_entity_id: params?.legalEntityId,
      },
    });
    return (res.data ?? []).map((loc) => {
      const bits = [loc.city, loc.country_code].filter(Boolean).join(', ');
      const mode =
        loc.is_remote ? 'Remote' : loc.is_hybrid ? 'Hybrid' : bits ? bits : undefined;
      return {
        id: loc.id,
        label: loc.name,
        subtitle: [loc.code, mode].filter(Boolean).join(' · ') || undefined,
        meta: { isRemote: loc.is_remote, isHybrid: loc.is_hybrid },
      };
    });
  },

  async searchRequisitions(params?: {
    query?: string;
    legalEntityId?: string;
    onlyPosted?: boolean;
  }): Promise<AsyncEntityOption[]> {
    const res = await api.get<Array<{ id: string; title: string; department?: string | null; status?: string }>>(
      '/api/recruitment/requisitions/options',
      {
        params: {
          search: params?.query ?? '',
          legal_entity_id: params?.legalEntityId,
          only_posted: params?.onlyPosted ? 'true' : undefined,
        },
      },
    );
    return (res.data ?? []).map((r) => ({
      id: r.id,
      label: r.title,
      subtitle: [r.department, r.status].filter(Boolean).join(' • '),
    }));
  },

  async searchOffers(params?: {
    query?: string;
    legalEntityId?: string;
    acceptedOnly?: boolean;
  }): Promise<AsyncEntityOption[]> {
    const res = await api.get<
      Array<{
        id: string;
        candidate_name: string;
        requisition_title: string;
        position?: string;
        department?: string | null;
        hiring_manager_name?: string | null;
        status: string;
      }>
    >('/api/recruitment/offers/options', {
      params: {
        search: params?.query ?? '',
        legal_entity_id: params?.legalEntityId,
        accepted_only: params?.acceptedOnly ? '1' : undefined,
      },
    });
    return (res.data ?? []).map((offer) => ({
      id: offer.id,
      label: `${offer.candidate_name} — ${offer.requisition_title}`,
      subtitle: [offer.position, offer.department, offer.status].filter(Boolean).join(' · ') || offer.status,
      meta: {
        position: offer.position,
        department: offer.department,
        hiring_manager_name: offer.hiring_manager_name,
        requisition_title: offer.requisition_title,
      },
    }));
  },
};
