import api from '../../services/api';

export async function fetchOverviewStats() {
  const { data } = await api.get('/workforce-stats/overview');
  return data;
}

export async function fetchLegalEntityStats(filters?: Record<string, string>) {
  const { data } = await api.get('/workforce-stats/legal-entities', { params: filters });
  return data;
}

export async function fetchOrgUnitStatsTree(filters?: Record<string, string>) {
  const { data } = await api.get('/workforce-stats/org-units/tree', { params: filters });
  return data;
}

export async function fetchCostCenterStats(filters?: Record<string, string>) {
  const { data } = await api.get('/workforce-stats/cost-centers', { params: filters });
  return data;
}

export async function fetchManagerHierarchyStats() {
  const { data } = await api.get('/workforce-stats/manager-hierarchy');
  return data;
}

export async function fetchHrExportStats() {
  const { data } = await api.get('/workforce-stats/hr-export');
  return data;
}

export async function fetchWorkforceIssues(filters?: Record<string, string>) {
  const { data } = await api.get('/workforce-issues', { params: filters });
  return data;
}

export async function resolveWorkforceIssue(issueId: string, note?: string) {
  const { data } = await api.post(`/workforce-issues/${issueId}/resolve`, { resolutionNote: note });
  return data;
}

export async function reopenWorkforceIssue(issueId: string) {
  const { data } = await api.post(`/workforce-issues/${issueId}/reopen`);
  return data;
}

export async function triggerStatsRefresh() {
  const { data } = await api.post('/workforce-stats/refresh');
  return data;
}

export async function triggerIssueDetection() {
  const { data } = await api.post('/workforce-issues/detect');
  return data;
}

export async function fetchGroupedIssues(filters?: Record<string, string>) {
  const { data } = await api.get('/workforce-issues/grouped', { params: filters });
  return data;
}

export async function fetchIssueCounts() {
  const { data } = await api.get('/workforce-issues/counts');
  return data;
}

export async function fetchManagerSuggestions(filters?: Record<string, string>) {
  const { data } = await api.get('/workforce-org-manager-suggestions', { params: filters });
  return data;
}

export async function generateManagerSuggestions() {
  const { data } = await api.post('/workforce-org-manager-suggestions/generate');
  return data;
}

export async function acceptManagerSuggestion(id: string) {
  const { data } = await api.post(`/workforce-org-manager-suggestions/${id}/accept`);
  return data;
}

export async function rejectManagerSuggestion(id: string) {
  const { data } = await api.post(`/workforce-org-manager-suggestions/${id}/reject`);
  return data;
}

export async function assignOrgUnitManager(orgUnitId: string, employeeId: string) {
  const { data } = await api.post('/workforce-org-manager-suggestions/assign-manual', { orgUnitId, employeeId });
  return data;
}

export async function bulkAcceptSuggestions(confidenceBand: string) {
  const { data } = await api.post('/workforce-org-manager-suggestions/bulk-accept', { confidenceBand });
  return data;
}

export async function fetchSuggestionMetrics() {
  const { data } = await api.get('/workforce-org-manager-suggestions/metrics');
  return data;
}

// ─── Bulk Remediation ───────────────────────────────────────

export async function previewBulkRemediation(body: {
  issueType: string;
  filters?: { legalEntityId?: string; orgUnitId?: string };
  proposedFix: Record<string, unknown>;
}) {
  const { data } = await api.post('/workforce-remediation/preview', body);
  return data;
}

export async function applyBulkRemediation(body: {
  issueType: string;
  filters?: { legalEntityId?: string; orgUnitId?: string };
  fix: Record<string, unknown>;
}) {
  const { data } = await api.post('/workforce-remediation/apply', body);
  return data;
}

export async function fetchImportAnalysis(jobId: string) {
  const { data } = await api.get(`/workforce-remediation/import-analysis/${jobId}`);
  return data;
}

export async function fetchQueueStats() {
  const { data } = await api.get('/workforce-issues/queue-stats');
  return data;
}

export async function fetchRemediationQueue(params?: Record<string, string>) {
  const { data } = await api.get('/workforce-issues/queue', { params });
  return data;
}

export async function assignIssue(issueId: string, assignedUserId: string) {
  const { data } = await api.post(`/workforce-issues/${issueId}/assign`, { assignedUserId });
  return data;
}

export async function unassignIssue(issueId: string) {
  const { data } = await api.post(`/workforce-issues/${issueId}/unassign`);
  return data;
}

export async function fetchBulkRemediationHistory(params?: Record<string, string | number | undefined>) {
  const { data } = await api.get('/workforce-remediation/history', { params });
  return data;
}

export async function fetchLegalEntityProgress() {
  const { data } = await api.get('/workforce-remediation/legal-entity-progress');
  return data;
}

export async function fetchUsers() {
  const { data } = await api.get('/users');
  return data;
}

// ─── Governance APIs ─────────────────────────────────────────

export async function checkRemediationPolicy(actionType: string, recordsAffected: number) {
  const { data } = await api.post('/workforce-remediation/check-policy', { actionType, recordsAffected });
  return data;
}

export async function requestRemediationApproval(dto: {
  actionType: string;
  issueType: string;
  recordsAffected: number;
  fixPayload: Record<string, unknown>;
  previewSummary?: Record<string, unknown>;
  filters?: { legalEntityId?: string; orgUnitId?: string };
}) {
  const { data } = await api.post('/workforce-remediation/request-approval', dto);
  return data;
}

export async function fetchRemediationApprovals(params?: Record<string, string>) {
  const { data } = await api.get('/workforce-remediation/approvals', { params });
  return data;
}

export async function fetchApprovalDetail(id: string) {
  const { data } = await api.get(`/workforce-remediation/approvals/${id}`);
  return data;
}

export async function approveRemediation(id: string) {
  const { data } = await api.post(`/workforce-remediation/approvals/${id}/approve`);
  return data;
}

export async function rejectRemediation(id: string, reason?: string) {
  const { data } = await api.post(`/workforce-remediation/approvals/${id}/reject`, { reason });
  return data;
}

export async function executeApprovedRemediation(id: string) {
  const { data } = await api.post(`/workforce-remediation/approvals/${id}/execute`);
  return data;
}

export async function fetchPendingApprovalCount() {
  const { data } = await api.get('/workforce-remediation/approvals/pending-count');
  return data;
}

export async function fetchGovernanceAuditTrail(params?: Record<string, string | number>) {
  const { data } = await api.get('/workforce-remediation/audit-trail', { params });
  return data;
}

// ─── Hierarchy Intelligence ─────────────────────────────────

export async function fetchTeamSummary(employeeId: string) {
  const { data } = await api.get(`/enterprise/employees/${employeeId}/team/summary`);
  return data;
}

export async function fetchDirectReports(employeeId: string) {
  const { data } = await api.get(`/enterprise/employees/${employeeId}/team/direct-reports`);
  return data;
}

export async function fetchTeamTree(employeeId: string, maxDepth = 3) {
  const { data } = await api.get(`/enterprise/employees/${employeeId}/team/tree`, { params: { maxDepth } });
  return data;
}

export async function fetchFlatTeam(employeeId: string) {
  const { data } = await api.get(`/enterprise/employees/${employeeId}/team/flat`);
  return data;
}
