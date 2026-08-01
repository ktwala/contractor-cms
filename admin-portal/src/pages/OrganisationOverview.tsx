import { Link } from 'react-router-dom';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Section, Stack, Banner, ui } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';
import { useSetupStatus } from '../hooks/useSetupStatus';
import OrganisationLinks from '../components/OrganisationLinks';
import GovernancePanel from '../components/GovernancePanel';
import { useOverviewStats } from '../features/workforce-stats/hooks/useOverviewStats';
import { StatCard, StatStrip } from '../features/workforce-stats/components/StatCard';
import { ReadinessBadge, ReadinessBar } from '../features/workforce-stats/components/ReadinessBadge';
import { IssueBadge } from '../features/workforce-stats/components/IssueBadge';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { ReadinessDeltaToast, RefreshStatusChip } from '../features/workforce-stats/components/ReadinessDeltaToast';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';
import { useReadinessDelta } from '../features/workforce-stats/hooks/useReadinessDelta';

export default function OrganisationOverview() {
  const { canAny } = useAccess();
  const { data: setupData } = useSetupStatus();
  const { stats, loading: statsLoading, refresh: refreshStats } = useOverviewStats();
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();
  const { deltas, visible: deltaVisible, captureSnapshot, compareAndShow, dismiss: dismissDelta } = useReadinessDelta();

  const handleRefreshWithDelta = async () => {
    if (stats) {
      captureSnapshot({
        missingManager: stats.dataQuality?.employeesWithoutManagerCount ?? 0,
        missingAssignment: stats.dataQuality?.employeesWithoutAssignmentCount ?? 0,
        missingCostCenter: stats.dataQuality?.employeesMissingCostCenterCount ?? 0,
        exportBlockers: stats.readiness?.exportBlockedCount ?? 0,
        readinessPercent: stats.readiness?.percent ?? 0,
        totalIssues: stats.readiness?.issuesCount ?? 0,
      });
    }
    await refreshStats();
    if (stats) {
      compareAndShow(
        {
          missingManager: stats.dataQuality?.employeesWithoutManagerCount ?? 0,
          missingAssignment: stats.dataQuality?.employeesWithoutAssignmentCount ?? 0,
          missingCostCenter: stats.dataQuality?.employeesMissingCostCenterCount ?? 0,
          exportBlockers: stats.readiness?.exportBlockedCount ?? 0,
          readinessPercent: stats.readiness?.percent ?? 0,
          totalIssues: stats.readiness?.issuesCount ?? 0,
        },
        {
          missingManager: 'Missing manager issues',
          missingAssignment: 'Missing assignment issues',
          missingCostCenter: 'Missing cost center issues',
          exportBlockers: 'Export blockers',
          readinessPercent: 'Readiness %',
          totalIssues: 'Total issues',
        },
      );
    }
  };

  const isIgaOnly =
    canAny(['hr:read']) &&
    !canAny(['iam:legal_entities:manage', 'iam:roles:manage', 'iam:users:manage', 'audit:events:read']);
  const canManageOrg = canAny(['iam:legal_entities:manage']);

  const allZero =
    setupData &&
    setupData.legal_entities === 0 &&
    setupData.org_units === 0 &&
    setupData.cost_centers === 0 &&
    setupData.positions === 0 &&
    setupData.employees === 0;

  return (
    <Page
      title="Organisation"
      subtitle="Define companies, group structure, and cost allocation."
      actions={
        canManageOrg ? (
          <div style={{ display: 'flex', gap: 10 }}>
            <Link to="/enterprise/company-groups" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
              Manage Groups
            </Link>
            <Link to="/enterprise/cost-centers" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
              Manage Cost Centers
            </Link>
          </div>
        ) : null
      }
    >
      <Stack gap={ui.space.lg}>
        {/* Platform Statistics Dashboard */}
        {stats && (
          <Section
            title="Platform Statistics"
            subtitle={stats.asOf ? `Last refreshed: ${new Date(stats.asOf).toLocaleString()}` : undefined}
            right={
              <button
                onClick={refreshStats}
                disabled={statsLoading}
                style={{
                  ...styles.buttonSecondary,
                  fontSize: 12,
                  padding: '6px 14px',
                  opacity: statsLoading ? 0.5 : 1,
                }}
              >
                {statsLoading ? 'Refreshing...' : 'Refresh Stats'}
              </button>
            }
          >
            <StatStrip columns={5}>
              <StatCard
                label="Employees"
                value={stats.workforce?.activeEmployeesCount ?? 0}
                subtitle={`${stats.workforce?.employeesCount ?? 0} total`}
                color="#6366f1"
              />
              <StatCard
                label="Employments"
                value={stats.workforce?.activeEmploymentsCount ?? 0}
                subtitle="active"
                color="#8b5cf6"
              />
              <StatCard
                label="Org Units"
                value={stats.structure?.orgUnitsCount ?? 0}
                subtitle={stats.structure?.unitsWithoutManagerCount ? `${stats.structure.unitsWithoutManagerCount} without manager` : undefined}
                color="#0ea5e9"
              />
              <StatCard
                label="Cost Centers"
                value={stats.structure?.costCentersCount ?? 0}
                color="#14b8a6"
              />
              <StatCard
                label="Legal Entities"
                value={stats.structure?.legalEntitiesCount ?? 0}
                color="#f59e0b"
              />
            </StatStrip>

            {/* Data Quality + Readiness row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Card>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Data Quality</span>
                    <IssueBadge
                      count={stats.readiness?.issuesCount ?? 0}
                      severity={stats.readiness?.blockersCount > 0 ? 'error' : 'warning'}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {[
                      { label: 'Without manager', count: stats.dataQuality?.employeesWithoutManagerCount ?? 0, type: 'MISSING_MANAGER', color: '#dc2626', groupBy: 'legalEntity' as const },
                      { label: 'Without assignment', count: stats.dataQuality?.employeesWithoutAssignmentCount ?? 0, type: 'MISSING_ORG_ASSIGNMENT', color: '#dc2626', groupBy: 'legalEntity' as const },
                      { label: 'Missing cost center', count: stats.dataQuality?.employeesMissingCostCenterCount ?? 0, type: 'MISSING_COST_CENTER', color: '#f59e0b', groupBy: 'orgUnit' as const },
                    ].map((row) => (
                      <div
                        key={row.type}
                        onClick={row.count > 0 ? () => openDrilldown({
                          issueType: row.type,
                          title: `Employees ${row.label.toLowerCase()}`,
                          groupBy: row.groupBy,
                        }) : undefined}
                        style={{
                          display: 'flex', justifyContent: 'space-between', fontSize: 13,
                          padding: '6px 8px', borderRadius: 6,
                          cursor: row.count > 0 ? 'pointer' : 'default',
                          transition: 'background .1s',
                        }}
                        onMouseEnter={(e) => row.count > 0 && ((e.currentTarget as HTMLElement).style.background = '#f1f5f9')}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = '')}
                      >
                        <span style={{ color: '#64748b' }}>{row.label}</span>
                        <span style={{ fontWeight: 600, color: row.count > 0 ? row.color : '#16a34a' }}>
                          {row.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
              <Card>
                <div style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Platform Readiness</span>
                    <ReadinessBadge status={stats.readiness?.status ?? 'INCOMPLETE'} percent={stats.readiness?.percent ?? 0} size="md" />
                  </div>
                  <ReadinessBar percent={stats.readiness?.percent ?? 0} status={stats.readiness?.status ?? 'INCOMPLETE'} height={8} />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginTop: 10, gap: 8 }}>
                    <div>
                      <span style={{ color: '#64748b' }}>Export ready: </span>
                      <span style={{ fontWeight: 600, color: '#16a34a' }}>{stats.readiness?.exportReadyCount ?? 0}</span>
                    </div>
                    <div
                      onClick={(stats.readiness?.exportBlockedCount ?? 0) > 0 ? () => openDrilldown({
                        issueType: 'EMPLOYEE_EXPORT_BLOCKED',
                        title: 'Export blocked employees',
                        groupBy: 'legalEntity',
                      }) : undefined}
                      style={{ cursor: (stats.readiness?.exportBlockedCount ?? 0) > 0 ? 'pointer' : 'default' }}
                    >
                      <span style={{ color: '#64748b' }}>Blocked: </span>
                      <span style={{ fontWeight: 600, color: '#dc2626', textDecoration: (stats.readiness?.exportBlockedCount ?? 0) > 0 ? 'underline dotted' : 'none' }}>
                        {stats.readiness?.exportBlockedCount ?? 0}
                      </span>
                    </div>
                    <div
                      onClick={(stats.readiness?.issuesCount ?? 0) > 0 ? () => openDrilldown({
                        title: 'All workforce issues',
                        groupBy: 'issueType',
                      }) : undefined}
                      style={{ cursor: (stats.readiness?.issuesCount ?? 0) > 0 ? 'pointer' : 'default' }}
                    >
                      <span style={{ color: '#64748b' }}>Issues: </span>
                      <span style={{ fontWeight: 600, color: '#f59e0b', textDecoration: (stats.readiness?.issuesCount ?? 0) > 0 ? 'underline dotted' : 'none' }}>
                        {stats.readiness?.issuesCount ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </div>

            {/* Import stats row */}
            {(stats.imports?.importJobsCount > 0) && (
              <StatStrip columns={3}>
                <StatCard
                  label="Import Jobs"
                  value={stats.imports?.importJobsCount ?? 0}
                  color="#64748b"
                />
                <StatCard
                  label="Published"
                  value={stats.imports?.importsPublishedCount ?? 0}
                  color="#22c55e"
                />
                <StatCard
                  label="Failed"
                  value={stats.imports?.importsFailedCount ?? 0}
                  color={stats.imports?.importsFailedCount > 0 ? '#ef4444' : '#64748b'}
                />
              </StatStrip>
            )}
          </Section>
        )}

        {/* Tenant readiness dashboard */}
        {setupData && (
          <Section
            title="Tenant readiness"
            subtitle={
              setupData.complete
                ? 'All required steps complete. Your organisation is ready for IGA integration.'
                : 'Complete these steps to make your organisation IGA-ready.'
            }
          >
            <Card>
              <div style={{ padding: ui.space.lg, display: 'flex', flexDirection: 'column', gap: ui.space.sm }}>
                {setupData.items.map((item) => {
                  const status = item.ready
                    ? 'complete'
                    : item.optional
                      ? 'optional'
                      : 'pending';
                  return (
                    <div
                      key={item.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '10px 14px',
                        borderRadius: 10,
                        border: `1px solid ${styles.colors.borderLight}`,
                        background:
                          status === 'complete'
                            ? 'rgba(34,197,94,0.06)'
                            : status === 'optional'
                              ? 'rgba(245,158,11,0.06)'
                              : 'transparent',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span
                          style={{
                            fontSize: 18,
                            fontWeight: 700,
                            color: status === 'complete' ? '#16a34a' : status === 'optional' ? '#d97706' : '#94a3b8',
                          }}
                        >
                          {status === 'complete' ? '✔' : status === 'optional' ? '⚠' : '○'}
                        </span>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 14, color: styles.colors.textPrimary }}>
                            {item.label}
                          </span>
                          {item.optional && (
                            <span style={{ fontSize: 11, color: styles.colors.textMuted, marginLeft: 6 }}>
                              optional
                            </span>
                          )}
                          <div style={{ fontSize: 12, color: styles.colors.textSecondary, marginTop: 2 }}>
                            {item.count} {item.count === 1 ? 'record' : 'records'}
                          </div>
                        </div>
                      </div>
                      {item.href && (
                        <Link
                          to={item.href}
                          style={{
                            ...styles.buttonSecondary,
                            textDecoration: 'none',
                            fontSize: 12,
                            padding: '6px 14px',
                          }}
                        >
                          {item.key === 'manager_hierarchy' ? 'Review' : item.ready ? 'View' : 'Setup'}
                        </Link>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            {!setupData.complete && (
              <div
                style={{
                  padding: '16px 20px',
                  background: 'rgba(79, 70, 229, 0.04)',
                  borderRadius: 12,
                  border: `1px solid rgba(79, 70, 229, 0.12)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: styles.colors.textPrimary, marginBottom: 2 }}>
                    Quick start with Bootstrap Organisation
                  </div>
                  <div style={{ fontSize: 13, color: styles.colors.textSecondary }}>
                    Upload a single onboarding workbook or bootstrap pack to set up everything at once.
                  </div>
                </div>
                <Link
                  to="/enterprise/bootstrap-organisation"
                  style={{
                    display: 'inline-block',
                    padding: '8px 20px',
                    background: styles.colors.primary,
                    color: 'white',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Bootstrap Organisation
                </Link>
              </div>
            )}
          </Section>
        )}

        {allZero && (
          <Banner variant="info">
            <strong>Welcome.</strong> Start by creating a{' '}
            <Link to="/enterprise/legal-entities" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Legal Entity
            </Link>
            , then set up your{' '}
            <Link to="/enterprise/org-structure" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Org Structure
            </Link>
            ,{' '}
            <Link to="/enterprise/cost-centers" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Cost Centers
            </Link>
            , and{' '}
            <Link to="/enterprise/employees" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Employees
            </Link>
            . Or use{' '}
            <Link to="/enterprise/data-imports" style={{ color: 'inherit', fontWeight: 600, textDecoration: 'underline' }}>
              Data Import
            </Link>{' '}
            to bulk load.
          </Banner>
        )}

        <OrganisationLinks
          legalEntities={setupData?.legal_entities ?? 0}
          orgUnits={setupData?.org_units ?? 0}
          costCenters={setupData?.cost_centers ?? 0}
          companyGroups={setupData?.company_groups ?? 0}
          positions={setupData?.positions ?? 0}
        />

        {isIgaOnly && (
          <Banner variant="info">
            You have read-only integration access. Focus: HR Export and organisation definitions for the feed.
          </Banner>
        )}

        <GovernancePanel />

        <Section
          title="How it fits together"
          subtitle="A clean enterprise model for HCM + Payroll (without boiling the ocean)."
        >
          <Card>
            <div id="how-it-fits" style={{ scrollMarginTop: 24 }}>
              <CardHeader title="Enterprise structure" subtitle="This is the mental model we'll ship in v1." />
              <div style={{ padding: ui.space.lg }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid rgba(0,0,0,0.08)',
                    background: 'rgba(0,0,0,0.02)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 13,
                    marginBottom: 14,
                  }}
                >
                  Company Group → Legal Entities → Org Units → Positions → Employments → Employment Assignments → Cost Center allocation
                </div>

                <ul
                  style={{
                    margin: 0,
                    paddingLeft: 18,
                    color: styles.colors.textSecondary,
                    fontSize: 13,
                    lineHeight: 1.55,
                  }}
                >
                  <li>
                    <strong>Legal Entity</strong> is the statutory/payroll boundary (ZA vs LS rules).
                  </li>
                  <li>
                    <strong>Org Units</strong> are the reporting structure (tree); managers sit here naturally.
                  </li>
                  <li>
                    <strong>Positions</strong> are workforce slots within org units (e.g. PAY-001 Payroll Officer). Vacant = ACTIVE with no occupant.
                  </li>
                  <li>
                    <strong>Cost Centers</strong> are financial allocation buckets (may differ from org units).
                  </li>
                  <li>
                    <strong>Employment</strong> attaches a person to a <strong>Legal Entity</strong> (the statutory/payroll boundary).
                  </li>
                  <li>
                    <strong>Employment Assignment</strong> links an employment to an <strong>Org Unit (required)</strong>, optional{' '}
                    <strong>Position</strong>, and optional <strong>Cost Center</strong> over time (effective-dated).
                  </li>
                  <li>
                    <strong>Company Groups</strong> consolidate across entities for reporting and oversight.
                  </li>
                </ul>
              </div>
            </div>
          </Card>
        </Section>
      </Stack>

      <IssueDrilldownDrawer
        open={drilldownState.open}
        onClose={closeDrilldown}
        issueType={drilldownState.issueType}
        entityType={drilldownState.entityType}
        legalEntityId={drilldownState.legalEntityId}
        orgUnitId={drilldownState.orgUnitId}
        title={drilldownState.title}
        groupBy={drilldownState.groupBy}
        onRefreshNeeded={handleRefreshWithDelta}
      />
      <ReadinessDeltaToast deltas={deltas} visible={deltaVisible} onDismiss={dismissDelta} />
    </Page>
  );
}
