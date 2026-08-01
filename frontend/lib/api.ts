import axios, { AxiosInstance } from 'axios';
import { resolveApiScope } from './api-contract';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api/v1';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token and org context to requests
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        
        const userStr = localStorage.getItem('user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            const scope = resolveApiScope(config.url);

            // API Contract: 'org-scoped' endpoints derive context dynamically
            // from the JWT token on the backend AccessContext.
            // We DO NOT inject organizationId as a query parameter because
            // the backend DTO validation pipe explicitly forbids it.
            // Global endpoints inherently ignore org scoping.
          } catch (e) {
            // Ignore JSON parse errors
          }
        }
      }
      return config;
    });

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        } else if (error.response?.status === 403) {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('api_error_403', {
                detail: {
                  message:
                    error.response?.data?.message || 'You do not have permission to perform this action.',
                },
              })
            );
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: any) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getDemoConfig(): Promise<{
    demoModeEnabled: boolean;
    hcmComparisonAnchorsPresent: boolean;
    nodeEnv: string;
  }> {
    const response = await this.client.get('/health/demo-config');
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  // Suppliers
  async getSuppliers(params?: any) {
    const response = await this.client.get('/suppliers', { params });
    return response.data;
  }

  async getSupplierGovernanceDashboard() {
    const response = await this.client.get('/suppliers/governance-dashboard');
    return response.data as {
      organizationId: string;
      oracleLinkedTotal: number;
      oracleConnectorHealth?: string;
      oracleConnectorLastError?: string | null;
      buckets: {
        synced: number;
        pendingEvidence: number;
        active: number;
        suspended: number;
      };
    };
  }

  async getOracleConnectorDashboard() {
    const response = await this.client.get('/supplier-sources/oracle/dashboard');
    return response.data;
  }

  async getOracleConnectorTelemetry() {
    const response = await this.client.get('/supplier-sources/oracle/telemetry');
    return response.data;
  }

  async getOracleConnectorHealth() {
    const response = await this.client.get('/supplier-sources/oracle/health');
    return response.data;
  }

  async listOracleSyncRuns(params?: {
    status?: string;
    mode?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/supplier-sources/oracle/sync-runs', {
      params,
    });
    return response.data;
  }

  async getOracleConnectorAnomalies() {
    const response = await this.client.get('/supplier-sources/oracle/anomalies');
    return response.data;
  }

  async getOracleHcmConnectorDashboard() {
    const response = await this.client.get('/contractor-sources/oracle-hcm/dashboard');
    return response.data;
  }

  async getOracleHcmConnectorTelemetry() {
    const response = await this.client.get('/contractor-sources/oracle-hcm/telemetry');
    return response.data;
  }

  async getOracleHcmConnectorHealth() {
    const response = await this.client.get('/contractor-sources/oracle-hcm/health');
    return response.data;
  }

  async listOracleHcmSyncRuns(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/contractor-sources/oracle-hcm/sync-runs', {
      params,
    });
    return response.data;
  }

  async listOracleHcmSourceDrift(params?: {
    status?: string;
    severity?: string;
    driftType?: string;
    operationalOnly?: boolean;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/contractor-sources/oracle-hcm/drift', { params });
    return response.data;
  }

  async detectOracleHcmSourceDrift() {
    const response = await this.client.post('/contractor-sources/oracle-hcm/drift/detect');
    return response.data;
  }

  async getWorkforceCutover(): Promise<{
    workforceMigrationCutoverAt: string | null;
    updatedAt: string;
    governancePhase: 'NO_CUTOVER' | 'PRE_CUTOVER' | 'POST_CUTOVER';
  }> {
    const response = await this.client.get('/contractor-sources/oracle-hcm/cutover');
    return response.data;
  }

  async setWorkforceCutover(cutoverAt: string | null): Promise<{
    workforceMigrationCutoverAt: string | null;
    updatedAt: string;
    governancePhase: 'NO_CUTOVER' | 'PRE_CUTOVER' | 'POST_CUTOVER';
  }> {
    const response = await this.client.post('/contractor-sources/oracle-hcm/cutover', {
      cutoverAt,
    });
    return response.data;
  }

  async listContractorGovernanceRemediation(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/contractor-governance/remediation', { params });
    return response.data;
  }

  async listOracleSourceDrift(params?: {
    status?: string;
    severity?: string;
    driftType?: string;
    page?: number;
    limit?: number;
  }) {
    const response = await this.client.get('/supplier-sources/oracle/drift', { params });
    return response.data;
  }

  async detectOracleSourceDrift() {
    const response = await this.client.post('/supplier-sources/oracle/drift/detect');
    return response.data;
  }

  async syncOracleSuppliers() {
    const response = await this.client.post('/supplier-sources/oracle/sync');
    return response.data as {
      summary?: { imported?: number; recordsImported?: number; new?: number; possibleMatch?: number };
      syncRunId?: string;
      syncRunStatus?: string;
    };
  }

  async listOracleStaging(params?: { matchStatus?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/supplier-sources/oracle/staging', { params });
    return response.data as {
      data?: Array<{
        id: string;
        name: string;
        externalSupplierId?: string;
        matchStatus?: string;
        matchReason?: string | null;
        matchedSupplier?: { displayName: string } | null;
      }>;
    };
  }

  async listSupplierReconciliationWorkItems() {
    const response = await this.client.get('/supplier-sources/oracle/reconciliation-work-items');
    return response.data as Array<{
      id: string;
      referenceName: string;
      reconciliationKind: 'POSSIBLE_MATCH' | 'CONFLICT';
      summary: string;
      proposedSupplierName: string | null;
      workerCount: number;
      observationSource: string;
    }>;
  }

  async promoteOracleStagingRow(stagingId: string) {
    const response = await this.client.post(
      `/supplier-sources/oracle/staging/${stagingId}/promote`,
    );
    return response.data as { status?: string; supplierId?: string; id?: string };
  }

  async assignSupplierPortalMembership(
    supplierId: string,
    body: { userEmail: string; role?: 'ADMIN' | 'MANAGER' },
  ) {
    const response = await this.client.post(
      `/suppliers/${supplierId}/portal-memberships`,
      body,
    );
    return response.data as {
      supplierId: string;
      userId: string;
      userEmail: string;
      role: string;
    };
  }

  async completeDemoSupplierSetup() {
    const response = await this.client.post(
      '/supplier-sources/oracle/demo/complete-supplier-setup',
    );
    return response.data as {
      supplierId: string;
      supplierStatus: string;
      supplierActivated: boolean;
      portalWorkersRemoved: number;
      portalMembership: { userEmail: string; role: string };
      contract: {
        id: string;
        contractNumber: string;
        status: string;
        created: boolean;
      };
    };
  }

  async completeMtnDemoStory() {
    const response = await this.client.post(
      '/supplier-sources/oracle/demo/complete-mtn-story',
    );
    return response.data as {
      suppliers: Array<{
        externalSupplierId: string;
        tradingName: string;
        supplierId: string;
        status: string;
        contractNumber: string;
        portalAdminEmail: string;
        promoted: boolean;
      }>;
      materialized: { created: number; skipped: number };
      engagementsCreated: number;
      sponsoredWorkers: number;
      skippedMissingResponsibleManagerWorkers: number;
    };
  }

  async syncOracleHcmWorkers() {
    const response = await this.client.post('/contractor-sources/oracle-hcm/sync');
    return response.data as {
      summary?: { imported?: number; matched?: number; possibleMatch?: number; conflict?: number };
      syncRunId?: string;
      syncRunStatus?: string;
    };
  }

  async materializeDemoHcmContractors() {
    const response = await this.client.post(
      '/contractor-sources/oracle-hcm/demo/materialize-contractors',
    );
    return response.data as { created: number; skipped: number };
  }

  async assignOracleSourceDrift(driftId: string, assignedToUserId: string) {
    const response = await this.client.post(
      `/supplier-sources/oracle/drift/${driftId}/assign`,
      { assignedToUserId },
    );
    return response.data;
  }

  async resolveOracleSourceDrift(driftId: string, resolutionNotes: string) {
    const response = await this.client.post(
      `/supplier-sources/oracle/drift/${driftId}/resolve`,
      { resolutionNotes },
    );
    return response.data;
  }

  async getSupplierApprovalQueue(params?: { evidenceIncomplete?: boolean }) {
    const response = await this.client.get('/suppliers/approvals', { params });
    return response.data;
  }

  async transitionSupplierStatus(
    id: string,
    data: { targetStatus: string; reason?: string },
  ) {
    const response = await this.client.patch(`/suppliers/${id}/status`, data);
    return response.data;
  }

  async getSupplier(id: string) {
    const response = await this.client.get(`/suppliers/${id}`);
    return response.data;
  }

  async createSupplier(data: any) {
    const response = await this.client.post('/suppliers', data);
    return response.data;
  }

  async updateSupplier(id: string, data: any) {
    const response = await this.client.patch(`/suppliers/${id}`, data);
    return response.data;
  }

  async deleteSupplier(id: string) {
    await this.client.delete(`/suppliers/${id}`);
  }

  async getSupplierEvidenceChecklist(supplierId: string) {
    const response = await this.client.get(`/suppliers/${supplierId}/evidence-checklist`);
    return response.data;
  }

  async getSupplierOperationalTrustEvidence(supplierId: string) {
    const response = await this.client.get(
      `/suppliers/${supplierId}/operational-trust-evidence`,
    );
    return response.data as {
      supplierId: string;
      currentStateLabel: string;
      oracleProcurementLabel: string | null;
      events: Array<{
        kind: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';
        label: string;
        actorDisplayName: string | null;
        occurredAt: string;
        reason: string | null;
      }>;
      latestGrant: {
        kind: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';
        label: string;
        actorDisplayName: string | null;
        occurredAt: string;
        reason: string | null;
      } | null;
      latestSuspension: {
        kind: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';
        label: string;
        actorDisplayName: string | null;
        occurredAt: string;
        reason: string | null;
      } | null;
    };
  }

  async getSupplierOperationalTrustWorkforceImpact() {
    const response = await this.client.get('/suppliers/operational-trust/workforce-impact');
    return response.data as {
      findings: Array<{
        supplierId: string;
        supplierName: string;
        operationalTrustStatus: string;
        operationalTrustLabel: string;
        affectedWorkerCount: number;
        impactSummary: string;
        resolutionAction: string;
      }>;
      workersAssessedPopulation: number;
      populationScope: string;
      evaluatedAt: string;
    };
  }

  async getSupplierOperationalTrustIntegrity() {
    const response = await this.client.get('/suppliers/operational-trust/integrity');
    return response.data as {
      integrity: 'PASS' | 'FAIL';
      evaluatedInvariants: number;
      violations: number;
      invariants: Array<{
        id: string;
        name: string;
        businessTruth: string;
        status: 'PASS' | 'FAIL';
        violationCount: number;
        violations: Array<{
          summary: string;
          context: Record<string, string | number>;
        }>;
      }>;
      evaluatedAt: string;
    };
  }

  async getSupplierDocuments(supplierId: string) {
    const response = await this.client.get(`/suppliers/${supplierId}/documents`);
    return response.data;
  }

  async createSupplierDocument(supplierId: string, data: Record<string, unknown>) {
    const response = await this.client.post(`/suppliers/${supplierId}/documents`, data);
    return response.data;
  }

  async updateSupplierDocument(
    supplierId: string,
    documentId: string,
    data: Record<string, unknown>,
  ) {
    const response = await this.client.patch(
      `/suppliers/${supplierId}/documents/${documentId}`,
      data,
    );
    return response.data;
  }

  // Supplier portal (PR-SUPPLIER-PORTAL-UI-1 — membership-scoped; not client /suppliers)
  async getSupplierPortalProfile() {
    const response = await this.client.get('/supplier-portal/profile');
    return response.data;
  }

  async updateSupplierPortalProfile(data: Record<string, unknown>) {
    const response = await this.client.patch('/supplier-portal/profile', data);
    return response.data;
  }

  async getSupplierPortalContractors(params?: { page?: number; limit?: number }) {
    const response = await this.client.get('/supplier-portal/contractors', { params });
    return response.data;
  }

  async getSupplierPortalContractor(id: string) {
    const response = await this.client.get(`/supplier-portal/contractors/${id}`);
    return response.data;
  }

  async getSupplierPortalContractorWorkforceHistory(id: string) {
    const response = await this.client.get(
      `/supplier-portal/contractors/${id}/workforce-history`,
    );
    return response.data;
  }

  async getSupplierPortalContracts() {
    const response = await this.client.get('/supplier-portal/contracts');
    return response.data;
  }

  async createSupplierPortalContractor(data: Record<string, unknown>) {
    const response = await this.client.post('/supplier-portal/contractors', data);
    return response.data;
  }

  async getSupplierPortalTimesheets(params?: Record<string, unknown>) {
    const response = await this.client.get('/supplier-portal/timesheets', { params });
    return response.data;
  }

  async getSupplierPortalInvoices(params?: Record<string, unknown>) {
    const response = await this.client.get('/supplier-portal/invoices', { params });
    return response.data;
  }

  async getSupplierPortalDashboard() {
    const response = await this.client.get('/supplier-portal/dashboard');
    return response.data;
  }

  async getSupplierPortalEvidenceChecklist() {
    const response = await this.client.get('/supplier-portal/evidence-checklist');
    return response.data;
  }

  async submitSupplierPortalForApproval() {
    const response = await this.client.post('/supplier-portal/submit-for-approval');
    return response.data;
  }

  async createSupplierPortalDocument(data: Record<string, unknown>) {
    const response = await this.client.post('/supplier-portal/documents', data);
    return response.data;
  }

  // Contractors
  async getContractorWorkforceReviewQueue(params?: { workforceState?: string }) {
    const response = await this.client.get('/contractors/workforce-review', { params });
    return response.data;
  }

  async getContractorWorkforceRejected() {
    const response = await this.client.get('/contractors/workforce-rejected');
    return response.data;
  }

  async getContractorWorkforceBlacklistEligible() {
    const response = await this.client.get('/contractors/workforce-blacklist-eligible');
    return response.data;
  }

  async transitionContractorWorkforceState(
    id: string,
    data: { targetState: string; reason?: string; authorityNote?: string },
  ) {
    const response = await this.client.patch(`/contractors/${id}/workforce-transition`, data);
    return response.data;
  }

  async getContractorWorkforceHistory(id: string) {
    const response = await this.client.get(`/contractors/${id}/workforce-history`);
    return response.data;
  }

  async getContractors(params?: any) {
    const response = await this.client.get('/contractors', { params });
    return response.data;
  }

  async getContractor(id: string) {
    const response = await this.client.get(`/contractors/${id}`);
    return response.data;
  }

  async createContractor(data: any) {
    const response = await this.client.post('/contractors', data);
    return response.data;
  }

  async updateContractor(id: string, data: any) {
    const response = await this.client.patch(`/contractors/${id}`, data);
    return response.data;
  }

  async deleteContractor(id: string) {
    await this.client.delete(`/contractors/${id}`);
  }

  // Contracts
  async getContracts(params?: any) {
    const response = await this.client.get('/contracts', { params });
    return response.data;
  }

  async createContract(data: any) {
    const response = await this.client.post('/contracts', data);
    return response.data;
  }

  async updateContract(id: string, data: any) {
    const response = await this.client.patch(`/contracts/${id}`, data);
    return response.data;
  }

  async deleteContract(id: string) {
    await this.client.delete(`/contracts/${id}`);
  }

  // Engagements
  async getEngagements(params?: any) {
    const response = await this.client.get('/engagements', { params });
    return response.data;
  }

  async createEngagement(data: any) {
    const response = await this.client.post('/engagements', data);
    return response.data;
  }

  async updateEngagement(id: string, data: any) {
    const response = await this.client.patch(`/engagements/${id}`, data);
    return response.data;
  }

  // Timesheets
  async getTimesheets(params?: any) {
    const response = await this.client.get('/timesheets', { params });
    return response.data;
  }

  async createTimesheet(data: any) {
    const response = await this.client.post('/timesheets', data);
    return response.data;
  }

  async updateTimesheet(id: string, data: any) {
    const response = await this.client.patch(`/timesheets/${id}`, data);
    return response.data;
  }

  async submitTimesheet(id: string) {
    const response = await this.client.patch(`/timesheets/${id}/submit`);
    return response.data;
  }

  async approveTimesheet(id: string) {
    const response = await this.client.patch(`/timesheets/${id}/approve`);
    return response.data;
  }

  async rejectTimesheet(id: string, reason: string) {
    const response = await this.client.patch(`/timesheets/${id}/reject`, { reason });
    return response.data;
  }

  // Invoices
  async getInvoices(params?: any) {
    const response = await this.client.get('/invoices', { params });
    return response.data;
  }

  async createInvoice(data: any) {
    const response = await this.client.post('/invoices', data);
    return response.data;
  }

  async submitInvoice(id: string) {
    const response = await this.client.patch(`/invoices/${id}/submit`);
    return response.data;
  }

  async approveInvoice(id: string) {
    const response = await this.client.patch(`/invoices/${id}/approve`);
    return response.data;
  }

  async markInvoicePaid(id: string, data: any) {
    const response = await this.client.patch(`/invoices/${id}/mark-paid`, data);
    return response.data;
  }

  async voidInvoice(id: string, reason: string) {
    const response = await this.client.patch(`/invoices/${id}/void`, { reason });
    return response.data;
  }

  async downloadInvoicePDF(id: string) {
    const response = await this.client.get(`/invoices/${id}/pdf`, {
      responseType: 'arraybuffer',
    });
    return response.data;
  }

  // Projects
  async getProjects(params?: any) {
    const response = await this.client.get('/projects', { params });
    return response.data;
  }

  async getProject(id: string) {
    const response = await this.client.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(data: any) {
    const response = await this.client.post('/projects', data);
    return response.data;
  }

  async updateProject(id: string, data: any) {
    const response = await this.client.patch(`/projects/${id}`, data);
    return response.data;
  }

  async getProjectBudgetUtilization(id: string) {
    const response = await this.client.get(`/projects/${id}/budget-utilization`);
    return response.data;
  }

  // Analytics
  async getDashboardAnalytics(params?: any) {
    const response = await this.client.get('/analytics/dashboard', { params });
    return response.data;
  }

  async getFinancialAnalytics(params?: any) {
    const response = await this.client.get('/analytics/financial', { params });
    return response.data;
  }

  async getContractorAnalytics() {
    const response = await this.client.get('/analytics/contractors');
    return response.data;
  }

  async getProjectAnalytics() {
    const response = await this.client.get('/analytics/projects');
    return response.data;
  }

  // Users
  async getUsers() {
    const response = await this.client.get('/users');
    return response.data;
  }

  async getUser(id: string) {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async updateUser(id: string, data: any) {
    const response = await this.client.patch(`/users/${id}`, data);
    return response.data;
  }

  async getUserRoles(id: string) {
    const response = await this.client.get(`/users/${id}/roles`);
    return response.data;
  }

  async assignRoles(id: string, roleIds: string[]) {
    const response = await this.client.put(`/users/${id}/roles`, { roleIds });
    return response.data;
  }

  async addRoles(id: string, roleIds: string[]) {
    const response = await this.client.post(`/users/${id}/roles`, { roleIds });
    return response.data;
  }

  async removeRole(userId: string, roleId: string) {
    const response = await this.client.delete(`/users/${userId}/roles/${roleId}`);
    return response.data;
  }

  // Roles
  async getRoles() {
    const response = await this.client.get('/roles');
    return response.data;
  }

  async getRole(id: string) {
    const response = await this.client.get(`/roles/${id}`);
    return response.data;
  }

  async createRole(data: any) {
    const response = await this.client.post('/roles', data);
    return response.data;
  }

  async updateRole(id: string, data: any) {
    const response = await this.client.patch(`/roles/${id}`, data);
    return response.data;
  }

  async deleteRole(id: string) {
    const response = await this.client.delete(`/roles/${id}`);
    return response.data;
  }

  // Sponsor accountability tasks (PR-SPONSOR-TASKS-1)
  async getResponsibleManagerTasks(params?: { status?: string; page?: number; limit?: number }) {
    const response = await this.client.get('/responsible-manager-tasks', { params });
    return response.data;
  }

  async completeResponsibleManagerTask(id: string, data?: { notes?: string; accessConfirmed?: boolean }) {
    const response = await this.client.patch(`/responsible-manager-tasks/${id}/complete`, data ?? {});
    return response.data;
  }

  async dismissResponsibleManagerTask(id: string, notes?: string) {
    const response = await this.client.patch(`/responsible-manager-tasks/${id}/dismiss`, { notes });
    return response.data;
  }

  // PDP governance control plane
  async listPdpActivationRules() {
    const response = await this.client.get('/pdp/activation');
    return response.data as {
      rules: unknown[];
      isEmergencyOverrideActive: boolean;
    };
  }

  async createPdpActivationRule(data: Record<string, unknown>) {
    const response = await this.client.post('/pdp/activation', data);
    return response.data;
  }

  async updatePdpActivationRule(id: string, data: Record<string, unknown>) {
    const response = await this.client.put(`/pdp/activation/${id}`, data);
    return response.data;
  }

  async disablePdpActivationRule(id: string, notes?: string) {
    const response = await this.client.delete(`/pdp/activation/${id}`, {
      data: notes ? { notes } : undefined,
    });
    return response.data;
  }

  async previewPdpEvaluation(data: Record<string, unknown>) {
    const response = await this.client.post('/pdp/activation/preview', data);
    return response.data;
  }

  async listPdpExceptions(status?: string) {
    const response = await this.client.get('/pdp/exceptions', {
      params: status ? { status } : undefined,
    });
    return response.data;
  }

  async createPdpException(data: Record<string, unknown>) {
    const response = await this.client.post('/pdp/exceptions', data);
    return response.data;
  }

  async approvePdpException(id: string, approvalNotes: string, expiresAt: string) {
    const response = await this.client.post(`/pdp/exceptions/${id}/approve`, {
      approvalNotes,
      expiresAt,
    });
    return response.data;
  }

  async rejectPdpException(id: string, approvalNotes: string) {
    const response = await this.client.post(`/pdp/exceptions/${id}/reject`, {
      approvalNotes,
    });
    return response.data;
  }

  async getPdpTelemetry(days = 30) {
    const response = await this.client.get('/pdp/telemetry', { params: { days } });
    return response.data;
  }
}

export const api = new ApiClient();
