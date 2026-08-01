import api from '../../services/api';
import type {
  AuthoringVersion,
  TemplateDefinition,
  TaxTableTemplateCardDto,
  ValidationIssue,
  SimulationResult,
  DiffResult,
  AuditEvent,
  PublishResult,
  PublishPolicy,
} from './types';

const BASE = '/tax-table-authoring';

export async function fetchTemplates(countryCode?: string): Promise<TemplateDefinition[]> {
  const params = countryCode ? { countryCode } : {};
  const res = await api.get(`${BASE}/templates`, { params });
  return res.data?.data ?? res.data ?? [];
}

export async function fetchTemplateCards(filters?: {
  countryCode?: string;
  tableType?: string;
  taxYear?: string;
}): Promise<TaxTableTemplateCardDto[]> {
  const res = await api.get(`${BASE}/templates`, { params: filters });
  return res.data?.data ?? res.data ?? [];
}

export async function fetchRecommendedTemplate(
  countryCode: string,
  tableType: string,
  taxYear: string,
): Promise<TaxTableTemplateCardDto | null> {
  const res = await api.get(`${BASE}/templates/recommended`, {
    params: { countryCode, tableType, taxYear },
  });
  return res.data?.data ?? res.data ?? null;
}

export async function fetchVersions(filters?: {
  countryCode?: string;
  tableType?: string;
  taxYear?: string;
  status?: string;
}): Promise<AuthoringVersion[]> {
  const res = await api.get(`${BASE}/versions`, { params: filters });
  return res.data?.data ?? res.data ?? [];
}

export async function fetchVersion(id: string): Promise<AuthoringVersion> {
  const res = await api.get(`${BASE}/versions/${id}`);
  return res.data?.data ?? res.data;
}

export async function createFromTemplate(input: {
  templateId: string;
  countryCode: string;
  tableType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/from-template`, input);
  return res.data?.data ?? res.data;
}

export async function createFromCopy(input: {
  sourceAuthoringId: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/from-copy`, input);
  return res.data?.data ?? res.data;
}

export async function createManual(input: {
  countryCode: string;
  tableType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo?: string;
  brackets: Array<{
    seqNo: number;
    bracketFrom: number;
    bracketTo: number | null;
    marginalRate: number;
    baseTax: number;
    isOpenEnded: boolean;
  }>;
  fields?: Array<{ fieldCode: string; fieldValue: unknown }>;
}): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/manual`, input);
  return res.data?.data ?? res.data;
}

export async function createFromImport(input: {
  countryCode: string;
  tableType: string;
  taxYear: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceReference?: string;
  brackets: Array<{
    seqNo: number;
    bracketFrom: number;
    bracketTo: number | null;
    marginalRate: number;
    baseTax: number;
    isOpenEnded: boolean;
  }>;
  fields?: Array<{ fieldCode: string; fieldValue: unknown }>;
}): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/import`, input);
  return res.data?.data ?? res.data;
}

export async function updateBrackets(
  id: string,
  brackets: Array<{
    seqNo: number;
    bracketFrom: number;
    bracketTo: number | null;
    marginalRate: number;
    baseTax: number;
    isOpenEnded: boolean;
  }>,
): Promise<AuthoringVersion> {
  const res = await api.put(`${BASE}/versions/${id}/brackets`, { brackets });
  return res.data?.data ?? res.data;
}

export async function updateFields(
  id: string,
  fields: Array<{ fieldCode: string; fieldValue: unknown }>,
): Promise<AuthoringVersion> {
  const res = await api.put(`${BASE}/versions/${id}/fields`, { fields });
  return res.data?.data ?? res.data;
}

export async function validateVersion(id: string): Promise<{ issues: ValidationIssue[] }> {
  const res = await api.get(`${BASE}/versions/${id}/validate`);
  return res.data?.data ?? res.data;
}

export async function simulateVersion(
  id: string,
  input: { annualIncomes: number[]; periodsPerYear?: number; age?: number },
): Promise<SimulationResult> {
  const res = await api.post(`${BASE}/versions/${id}/simulate`, input);
  return res.data?.data ?? res.data;
}

export async function diffAgainstRuntime(id: string): Promise<DiffResult> {
  const res = await api.get(`${BASE}/versions/${id}/diff`);
  return res.data?.data ?? res.data;
}

export async function submitForApproval(id: string, comment?: string): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/${id}/submit-approval`, { comment });
  return res.data?.data ?? res.data;
}

export async function approveVersion(id: string, comment?: string): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/${id}/approve`, { comment });
  return res.data?.data ?? res.data;
}

export async function publishVersion(id: string, reason?: string): Promise<PublishResult> {
  const res = await api.post(`${BASE}/versions/${id}/publish`, { reason });
  return res.data?.data ?? res.data;
}

export async function archiveVersion(id: string): Promise<AuthoringVersion> {
  const res = await api.post(`${BASE}/versions/${id}/archive`);
  return res.data?.data ?? res.data;
}

export async function fetchAuditTrail(id: string): Promise<AuditEvent[]> {
  const res = await api.get(`${BASE}/versions/${id}/audit`);
  return res.data?.data ?? res.data ?? [];
}

export async function fetchPublishPolicy(): Promise<PublishPolicy> {
  const res = await api.get(`${BASE}/publish-policy`);
  return res.data?.data ?? res.data;
}

export async function fetchActiveRuntime(params: {
  country: string;
  tableType: string;
  date?: string;
}): Promise<any> {
  const res = await api.get(`${BASE}/runtime/active`, { params });
  return res.data?.data ?? res.data;
}

export async function fetchRuntimeById(id: string): Promise<any> {
  const res = await api.get(`${BASE}/runtime/${id}`);
  return res.data?.data ?? res.data;
}

export async function fetchPublishedRuntime(authoringId: string): Promise<any> {
  const res = await api.get(`${BASE}/versions/${authoringId}/published-runtime`);
  return res.data?.data ?? res.data;
}

// ─── Impact Analysis ───

export async function runImpactAnalysis(payload: {
  authoringVersionId: string;
  basisMode: 'LAST_CLOSED_PAYRUN' | 'PAYRUN_ID';
  payGroupId?: string;
  payrunId?: string;
  countryCode: 'ZA' | 'LS';
  legalEntityId?: string;
  limit?: number;
  affectedOnly?: boolean;
  minAbsoluteDelta?: number;
}): Promise<any> {
  const res = await api.post('/tax-table-impact-analysis/run', payload);
  return res.data?.data ?? res.data;
}

export async function fetchPayGroups(countryCode?: string): Promise<any[]> {
  const params = countryCode ? { country: countryCode } : {};
  const res = await api.get('/pay-groups', { params });
  return res.data?.data ?? res.data ?? [];
}

// ─── Impact Analysis Runs + Export + Sign-off ───

export async function listImpactAnalysisRuns(authoringVersionId: string) {
  const res = await api.get(`/tax-table-impact-analysis/authoring/${authoringVersionId}/runs`);
  return res.data?.data ?? res.data ?? [];
}

export async function getImpactAnalysisRun(runId: string) {
  const res = await api.get(`/tax-table-impact-analysis/runs/${runId}`);
  return res.data?.data ?? res.data;
}

export async function getImpactAnalysisLatestReview(authoringVersionId: string) {
  const res = await api.get(`/tax-table-impact-analysis/authoring/${authoringVersionId}/latest-review`);
  return res.data?.data ?? res.data;
}

export async function reviewImpactAnalysisRun(
  runId: string,
  payload: { reviewStatus: 'REVIEWED' | 'ACCEPTED' | 'CONCERNS_RAISED' | 'REJECTED'; reviewComment?: string },
) {
  const res = await api.post(`/tax-table-impact-analysis/runs/${runId}/review`, payload);
  return res.data?.data ?? res.data;
}

export async function exportImpactAnalysisRunCsv(runId: string) {
  const res = await api.post(
    `/tax-table-impact-analysis/runs/${runId}/export`,
    { format: 'CSV' },
    { responseType: 'blob' },
  );
  return res.data;
}
