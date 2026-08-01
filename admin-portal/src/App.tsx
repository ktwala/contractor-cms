import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import BootstrapAdmin from './pages/BootstrapAdmin';
import BootstrapLoading from './components/BootstrapLoading';
import AdminLayout from './components/AdminLayout';
import { useAccess } from './hooks/useAccess';
import { useBootstrapStatus } from './hooks/useBootstrapStatus';

/** Any of these permissions grants access to the admin portal. Aligned with RBAC_SPEC. */
const ADMIN_PORTAL_ENTRY_PERMISSIONS = [
  'iam:legal_entities:manage',
  'iam:roles:manage',
  'iam:users:manage',
  'payrun:read',
  'pay_group:read',
  'sars:irp5:read',
  'audit:events:read',
  'employee:read',
  'employment:read',
  'hr:read', // IGA/integration users
];
import CompanyGroups from './pages/CompanyGroups';
import Dashboard from './pages/Dashboard';
import OrganisationOverview from './pages/OrganisationOverview';
import LegalEntities from './pages/LegalEntities';
import OrgStructure from './pages/OrgStructure';
import Positions from './pages/Positions';
import EmploymentAssignments from './pages/EmploymentAssignments';
import ApprovalWorkflows from './pages/ApprovalWorkflows';
import PendingApprovals from './pages/PendingApprovals';
import RolesManagement from './pages/RolesManagement';
import CostCenters from './pages/CostCenters';
import PayrollCalendars from './pages/PayrollCalendars';
import PayrollChecklist from './pages/PayrollChecklist';
import PayrollExceptions from './pages/PayrollExceptions';
import PayrollForecasting from './pages/PayrollForecasting';
import JobRequisitions from './pages/JobRequisitions';
import Candidates from './pages/Candidates';
import Interviews from './pages/Interviews';
import Offers from './pages/Offers';
import Onboarding from './pages/Onboarding';
import PaymentBatches from './pages/PaymentBatches';
import PaymentBatchDetail from './pages/PaymentBatchDetail';
import PayrollReports from './pages/PayrollReports';
import SARSReports from './pages/SARSReports';
import TaxTables from './pages/TaxTables';
import StatutoryConfig from './pages/StatutoryConfig';
import StatutoryReturns from './pages/StatutoryReturns';
import StatutoryReturnDetail from './pages/StatutoryReturnDetail';
import ComplianceDashboard from './pages/ComplianceDashboard';
import Employees from './pages/Employees';
import EmployeeDetail from './pages/EmployeeDetail';
import HrExportValidation from './pages/HrExportValidation';
import Users from './pages/Users';
import UserDetail from './pages/UserDetail';
import DataImports from './pages/DataImports';
import DataImportDetail from './pages/DataImportDetail';
import DataImportWizard from './pages/DataImportWizard';
import BootstrapPackImport from './pages/BootstrapPackImport';
import BootstrapOrganisation from './pages/BootstrapOrganisation';
import PayrollSupplementalImport from './pages/PayrollSupplementalImport';
import PayrollOpeningBalancesImport from './pages/PayrollOpeningBalancesImport';
import ManagerHierarchy from './pages/ManagerHierarchy';
import OrgUnitManagerReview from './pages/OrgUnitManagerReview';
import RemediationQueue from './pages/RemediationQueue';
import BulkRemediationHistory from './pages/BulkRemediationHistory';
import LegalEntityProgress from './pages/LegalEntityProgress';
import RemediationApprovals from './pages/RemediationApprovals';
import RemediationAudit from './pages/RemediationAudit';
import PayrollRunCenter from './pages/PayrollRunCenter';
import PayrunsList from './pages/PayrunsList';
import CreatePayrun from './pages/CreatePayrun';
import PayrunDetail from './pages/PayrunDetail';
import PayrunGovernanceDashboard from './pages/PayrunGovernanceDashboard';
import GovernancePortfolio from './pages/GovernancePortfolio';
import GovernancePolicies from './pages/GovernancePolicies';
import PayrollsHub from './pages/PayrollsHub';
import PayrollContainerDetail from './pages/PayrollContainerDetail';
import PayrollReconciliation from './pages/PayrollReconciliation';
import PayrollCompliance from './pages/PayrollCompliance';
import TaxTablesListPage from './features/tax-table-authoring/pages/TaxTablesListPage';
import TaxTableCreateWizardPage from './features/tax-table-authoring/pages/TaxTableCreateWizardPage';
import TaxTableAuthoringDetailPage from './features/tax-table-authoring/pages/TaxTableAuthoringDetailPage';
import TaxTableRuntimePage from './features/tax-table-authoring/pages/TaxTableRuntimePage';
import DevPageStates from './pages/DevPageStates';
import CtcOptimiserPage from './features/ctc-optimiser/CtcOptimiserPage';

function ConnectionLost({ onRetry }: { onRetry: () => Promise<void> }) {
  const [retrying, setRetrying] = React.useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try { await onRetry(); } finally { setRetrying(false); }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      color: 'white', padding: '2rem', textAlign: 'center',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
      }}>
        <svg width="28" height="28" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M18.364 5.636a9 9 0 010 12.728M5.636 18.364a9 9 0 010-12.728M12 9v4m0 4h.01" />
        </svg>
      </div>
      <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: 700 }}>
        Unable to connect
      </h2>
      <p style={{ margin: '0 0 24px', fontSize: '0.9rem', opacity: 0.75, maxWidth: 420 }}>
        The server is not responding. This usually means the backend is restarting or temporarily unavailable. Your session will resume once connectivity is restored.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={handleRetry}
          disabled={retrying}
          style={{
            padding: '10px 24px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.3)',
            background: 'rgba(255,255,255,0.1)', color: 'white', fontSize: 14, fontWeight: 600,
            cursor: retrying ? 'wait' : 'pointer', opacity: retrying ? 0.6 : 1,
          }}
        >
          {retrying ? 'Reconnecting…' : 'Retry connection'}
        </button>
        <a
          href="/login"
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none',
            background: 'white', color: '#0f172a', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}
        >
          Go to Login
        </a>
      </div>
    </div>
  );
}

function ProtectedRoute({
  children,
  bootstrapRequired,
}: {
  children: React.ReactNode;
  bootstrapRequired: boolean;
}) {
  const { isAuthenticated, canAny } = useAccess();

  if (bootstrapRequired) {
    return <Navigate to="/setup/admin" replace />;
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!canAny(ADMIN_PORTAL_ENTRY_PERMISSIONS)) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { loading, bootstrapRequired, connectionFailed, refetch } = useBootstrapStatus();

  if (loading) {
    return <BootstrapLoading />;
  }

  if (connectionFailed) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/setup/admin" element={<BootstrapAdmin />} />
        <Route path="*" element={<ConnectionLost onRetry={refetch} />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          bootstrapRequired ? (
            <Navigate to="/setup/admin" replace />
          ) : (
            <Login />
          )
        }
      />
      <Route
        path="/setup/admin"
        element={<BootstrapAdmin />}
      />

      {/* All protected routes use AdminLayout */}
      <Route
        element={
          <ProtectedRoute bootstrapRequired={bootstrapRequired}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/enterprise/organisation" element={<OrganisationOverview />} />
          <Route path="/enterprise/company-groups" element={<CompanyGroups />} />
          <Route path="/enterprise/legal-entities" element={<LegalEntities />} />
          <Route path="/enterprise/org-structure" element={<OrgStructure />} />
          <Route path="/enterprise/positions" element={<Positions />} />
          <Route path="/enterprise/employment-assignments" element={<EmploymentAssignments />} />
          <Route path="/enterprise/users" element={<Users />} />
          <Route path="/enterprise/users/:userId" element={<UserDetail />} />
          <Route path="/enterprise/workflows" element={<ApprovalWorkflows />} />
          <Route path="/enterprise/approvals/pending" element={<PendingApprovals />} />
          <Route path="/enterprise/roles" element={<RolesManagement />} />
          <Route path="/enterprise/cost-centers" element={<CostCenters />} />
          <Route path="/enterprise/employees" element={<Employees />} />
          <Route path="/enterprise/employees/:employeeId" element={<EmployeeDetail />} />
          <Route path="/enterprise/manager-hierarchy" element={<ManagerHierarchy />} />
          <Route path="/workforce/org-unit-manager-review" element={<OrgUnitManagerReview />} />
          <Route path="/workforce/remediation" element={<RemediationQueue />} />
          <Route path="/workforce/remediation/history" element={<BulkRemediationHistory />} />
          <Route path="/workforce/remediation/approvals" element={<RemediationApprovals />} />
          <Route path="/workforce/remediation/audit" element={<RemediationAudit />} />
          <Route path="/workforce/legal-entity-progress" element={<LegalEntityProgress />} />
          <Route path="/enterprise/hr-export" element={<HrExportValidation />} />
          <Route path="/enterprise/data-imports" element={<DataImports />} />
          <Route path="/enterprise/data-imports/wizard" element={<DataImportWizard />} />
          <Route path="/enterprise/data-imports/bootstrap-pack" element={<BootstrapPackImport />} />
          <Route path="/enterprise/data-imports/payroll-supplemental" element={<PayrollSupplementalImport />} />
          <Route path="/enterprise/data-imports/payroll-opening-balances" element={<PayrollOpeningBalancesImport />} />
          <Route path="/enterprise/bootstrap-organisation" element={<BootstrapOrganisation />} />
          <Route path="/enterprise/data-imports/:jobId" element={<DataImportDetail />} />
          <Route path="/payroll/payrolls" element={<PayrollsHub />} />
          <Route path="/payroll/payrolls/:id" element={<PayrollContainerDetail />} />
          <Route path="/payroll/run-center" element={<PayrollRunCenter />} />
          <Route path="/payroll/payruns" element={<PayrunsList />} />
          <Route path="/payroll/payruns/new" element={<CreatePayrun />} />
          <Route path="/payroll/payruns/:id" element={<PayrunDetail />} />
          <Route path="/payroll/payruns/:id/governance" element={<PayrunGovernanceDashboard />} />
          <Route path="/payroll/governance-portfolio" element={<GovernancePortfolio />} />
          <Route path="/payroll/governance-policies" element={<GovernancePolicies />} />
          <Route path="/payroll/calendars" element={<PayrollCalendars />} />
          <Route path="/payroll/checklist" element={<PayrollChecklist />} />
          <Route path="/payroll/exceptions" element={<PayrollExceptions />} />
          <Route path="/payroll/forecasting" element={<PayrollForecasting />} />
          <Route path="/payroll/payment-batches" element={<PaymentBatches />} />
          <Route path="/payroll/payment-batches/:id" element={<PaymentBatchDetail />} />
          <Route path="/payroll/reports" element={<PayrollReports />} />
          <Route path="/payroll/reconciliation" element={<PayrollReconciliation />} />
          <Route path="/payroll/compliance" element={<PayrollCompliance />} />
          <Route path="/payroll/ctc-optimiser" element={<CtcOptimiserPage />} />
          <Route path="/payroll/sars-reports" element={<SARSReports />} />
          <Route path="/recruitment/job-requisitions" element={<JobRequisitions />} />
          <Route path="/recruitment/candidates" element={<Candidates />} />
          <Route path="/recruitment/interviews" element={<Interviews />} />
          <Route path="/recruitment/offers" element={<Offers />} />
          <Route path="/recruitment/onboarding" element={<Onboarding />} />
          <Route path="/admin/tax-tables" element={<TaxTables />} />
          <Route path="/admin/payroll/tax-tables" element={<TaxTablesListPage />} />
          <Route path="/admin/payroll/tax-tables/create" element={<TaxTableCreateWizardPage />} />
          <Route path="/admin/payroll/tax-tables/authoring/:id" element={<TaxTableAuthoringDetailPage />} />
          <Route path="/admin/payroll/tax-tables/runtime" element={<TaxTableRuntimePage />} />
          <Route path="/payroll/compliance-dashboard" element={<ComplianceDashboard />} />
          <Route path="/payroll/statutory-returns" element={<StatutoryReturns />} />
          <Route path="/payroll/statutory-returns/:id" element={<StatutoryReturnDetail />} />
          <Route path="/admin/statutory-config" element={<StatutoryConfig />} />
          <Route path="/dev/page-states" element={<DevPageStates />} />
      </Route>

      <Route
        path="/"
        element={
          bootstrapRequired ? (
            <Navigate to="/setup/admin" replace />
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}

export default App;
