import { Link } from 'react-router-dom';
import { Page, Stack, ui } from '../ui/layout';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import SetupDashboard from '../components/SetupDashboard';
import WorkforceStats from '../components/WorkforceStats';
import * as styles from '../styles/common';
import PayrollSnapshot from '../components/PayrollSnapshot';
import ComplianceSnapshot from '../components/ComplianceSnapshot';
import DataImportsWidget from '../components/DataImportsWidget';
import HrExportReadinessWidget from '../components/HrExportReadinessWidget';
import PendingApprovalsWidget from '../components/PendingApprovalsWidget';

/** Dashboard renders widgets from a single aggregated GET /dashboard/summary call. */
export default function Dashboard() {
  const { data, loading, error } = useDashboardSummary();

  const widgets = data?.widgets ?? {};
  const setupProgress = widgets.setup_progress as { visible: true; data: any } | { visible: false } | undefined;
  const workforceSnapshot = widgets.workforce_snapshot as { visible: true; data: any } | { visible: false } | undefined;
  const payrollSnapshot = widgets.payroll_snapshot as { visible: true; data: any } | { visible: false } | undefined;
  const complianceSnapshot = widgets.compliance_snapshot as { visible: true; data: any } | { visible: false } | undefined;
  const pendingApprovals = widgets.pending_approvals as { visible: true; data: any } | { visible: false } | undefined;
  const dataImports = widgets.data_imports as { visible: true; data: any } | { visible: false } | undefined;
  const hrExportReadiness = widgets.hr_export_readiness as { visible: true; data: any } | { visible: false } | undefined;

  const visibleWidgets = [
    setupProgress?.visible && setupProgress,
    workforceSnapshot?.visible && workforceSnapshot,
    payrollSnapshot?.visible && payrollSnapshot,
    complianceSnapshot?.visible && complianceSnapshot,
    pendingApprovals?.visible && pendingApprovals,
    dataImports?.visible && dataImports,
    hrExportReadiness?.visible && hrExportReadiness,
  ].filter(Boolean);
  const hasAnyWidget = visibleWidgets.length > 0;

  const row1 = [workforceSnapshot?.visible, payrollSnapshot?.visible, complianceSnapshot?.visible].filter(Boolean).length;
  const row2 = [pendingApprovals?.visible, dataImports?.visible, hrExportReadiness?.visible].filter(Boolean).length;

  if (loading) {
    return (
      <Page title="Dashboard" subtitle="Operational summary of the platform.">
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary, #64748b)', fontSize: 14 }}>
          Loading dashboard…
        </div>
      </Page>
    );
  }

  if (error) {
    return (
      <Page title="Dashboard" subtitle="Operational summary of the platform.">
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--danger, #ef4444)', fontSize: 14 }}>
          {error}
        </div>
      </Page>
    );
  }

  return (
    <Page
      title="Dashboard"
      subtitle="Operational summary of the platform."
    >
      <Stack gap={ui.space.lg}>
        {setupProgress?.visible && setupProgress.data && (
          <>
            <SetupDashboard data={setupProgress.data} />
            {!setupProgress.data?.summary?.is_complete && (
              <div
                style={{
                  padding: 12,
                  background: 'rgba(79, 70, 229, 0.06)',
                  borderRadius: 10,
                  border: `1px solid ${styles.colors.borderLight}`,
                  display: 'flex',
                  gap: 24,
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                <Link
                  to="/enterprise/bootstrap-organisation"
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: styles.colors.primary,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  Bootstrap Organisation
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
                <Link
                  to="/enterprise/data-imports/wizard"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: styles.colors.textSecondary,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  Import Wizard
                  <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </>
        )}

        {row1 > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row1}, 1fr)`, gap: 24 }}>
            {workforceSnapshot?.visible && workforceSnapshot.data && (
              <WorkforceStats
                employees={workforceSnapshot.data.employees ?? 0}
                employments={workforceSnapshot.data.employments ?? 0}
              />
            )}
            {payrollSnapshot?.visible && (
              <PayrollSnapshot data={payrollSnapshot.data ?? null} loading={false} />
            )}
            {complianceSnapshot?.visible && (
              <ComplianceSnapshot data={complianceSnapshot.data ?? null} loading={false} />
            )}
          </div>
        )}

        {row2 > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${row2}, 1fr)`, gap: 24 }}>
            {pendingApprovals?.visible && (
              <PendingApprovalsWidget data={pendingApprovals.data ?? null} loading={false} />
            )}
            {dataImports?.visible && (
              <DataImportsWidget data={dataImports.data ?? null} loading={false} />
            )}
            {hrExportReadiness?.visible && (
              <HrExportReadinessWidget data={hrExportReadiness.data ?? null} loading={false} />
            )}
          </div>
        )}

        {!hasAnyWidget && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-secondary, #64748b)', fontSize: 14 }}>
            No dashboard widgets available for your role. Contact your administrator for access.
          </div>
        )}
      </Stack>
    </Page>
  );
}
