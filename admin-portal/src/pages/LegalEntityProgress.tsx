import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import * as styles from '../styles/common';
import { Page, Card, CardHeader } from '../ui/layout';
import { fetchLegalEntityProgress } from '../features/workforce-stats/api';
import { IssueDrilldownDrawer } from '../features/workforce-stats/components/IssueDrilldownDrawer';
import { useIssueDrilldown } from '../features/workforce-stats/hooks/useIssueDrilldown';
import { classifyPageState } from '../utils/pageState';
import { PageStateView } from '../ui/PageStateViews';

const STATUS_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  READY: { bg: '#dcfce7', fg: '#166534', label: 'Ready' },
  WARNING: { bg: '#fef9c3', fg: '#854d0e', label: 'Warning' },
  BLOCKED: { bg: '#fee2e2', fg: '#991b1b', label: 'Blocked' },
  INCOMPLETE: { bg: '#f1f5f9', fg: '#475569', label: 'Incomplete' },
};

export default function LegalEntityProgress() {
  const navigate = useNavigate();
  const { drilldownState, openDrilldown, closeDrilldown } = useIssueDrilldown();
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const data = await fetchLegalEntityProgress();
      setEntities(Array.isArray(data) ? data : []);
    } catch (err) {
      setLoadError(err);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const overallReadiness = entities.length > 0
    ? Math.round(entities.reduce((s, e) => s + e.readinessPercent, 0) / entities.length)
    : 0;

  const totalIssues = entities.reduce((s, e) => s + e.openIssues, 0);
  const totalBlockers = entities.reduce((s, e) => s + e.exportBlockers, 0);
  const resolvedToday = entities.reduce((s, e) => s + e.resolvedToday, 0);

  const progressBar = (percent: number, status: string) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.INCOMPLETE;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 150 }}>
        <div style={{ flex: 1, height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(percent, 100)}%`, height: '100%', borderRadius: 4, background: cfg.fg, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 700, color: cfg.fg, minWidth: 36 }}>{percent}%</span>
      </div>
    );
  };

  const pageState = classifyPageState({ loading, error: loadError, data: entities });

  return (
    <Page
      title="Legal Entity Readiness"
      subtitle="Track readiness progress across all legal entities."
    >
      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          onRetry={load}
          emptyTitle="No legal entities found"
          emptyMessage="Create a legal entity to begin tracking readiness."
          page="enterprise.legalEntityProgress"
          module="enterprise"
        />
      ) : (
      <>
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: overallReadiness >= 90 ? '#16a34a' : overallReadiness >= 70 ? '#ca8a04' : '#dc2626' }}>
              {overallReadiness}%
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Overall readiness</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: totalIssues > 0 ? '#dc2626' : '#16a34a' }}>{totalIssues}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Open issues</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: totalBlockers > 0 ? '#dc2626' : '#16a34a' }}>{totalBlockers}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Export blockers</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{resolvedToday}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Resolved today</div>
          </div>
        </Card>
      </div>

      {/* Entity table */}
      <Card>
        <CardHeader title={`Legal Entities (${entities.length})`} />
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Legal Entity</th>
                  <th style={styles.tableHeaderCell}>Employees</th>
                  <th style={styles.tableHeaderCell}>Readiness</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Open Issues</th>
                  <th style={styles.tableHeaderCell}>Blockers</th>
                  <th style={styles.tableHeaderCell}>Resolved Today</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((le: any) => {
                  const cfg = STATUS_CONFIG[le.readinessStatus] || STATUS_CONFIG.INCOMPLETE;
                  return (
                    <tr key={le.legalEntityId} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{le.name}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{le.code}</div>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontWeight: 600 }}>{le.employeeCount}</span>
                      </td>
                      <td style={{ ...styles.tableCell, minWidth: 160 }}>
                        {progressBar(le.readinessPercent, le.readinessStatus)}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: cfg.bg, color: cfg.fg,
                        }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        {le.openIssues > 0 ? (
                          <button
                            onClick={() => openDrilldown({ legalEntityId: le.legalEntityId, groupBy: 'issueType', title: `${le.name} — Issues` })}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: '#dc2626', fontWeight: 700, fontSize: 14,
                              textDecoration: 'underline', padding: 0,
                            }}
                          >
                            {le.openIssues}
                          </button>
                        ) : (
                          <span style={{ color: '#16a34a', fontWeight: 600 }}>0</span>
                        )}
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ color: le.exportBlockers > 0 ? '#dc2626' : '#16a34a', fontWeight: 600 }}>
                          {le.exportBlockers}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ color: '#16a34a', fontWeight: 500 }}>{le.resolvedToday}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <button
                          onClick={() => navigate(`/enterprise/employees?legalEntityId=${le.legalEntityId}`)}
                          style={{
                            padding: '4px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                            background: '#f8fafc', fontSize: 11, fontWeight: 500,
                            cursor: 'pointer', color: '#475569',
                          }}
                        >
                          View employees
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
      </Card>
      </>
      )}

      <IssueDrilldownDrawer
        {...drilldownState}
        onClose={closeDrilldown}
        onRefreshNeeded={load}
      />
    </Page>
  );
}
