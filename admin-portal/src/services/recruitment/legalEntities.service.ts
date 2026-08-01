import api from '../api';

export type LegalEntityItem = {
  id: string;
  code: string;
  name: string;
};

export async function fetchLegalEntities(): Promise<LegalEntityItem[]> {
  const res = await api.get<{ items: LegalEntityItem[] }>('/legal-entities', {
    params: { limit: 200, offset: 0 },
  });
  return res.data?.items ?? [];
}
