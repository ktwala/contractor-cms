import { useEffect, useState, useCallback } from 'react';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Stack, Banner, ui } from '../ui/layout';
import {
  fetchManagerSuggestions, generateManagerSuggestions,
  acceptManagerSuggestion, rejectManagerSuggestion, triggerStatsRefresh,
  bulkAcceptSuggestions, fetchSuggestionMetrics,
} from '../features/workforce-stats/api';

type RunnerUp = {
  employeeName: string;
  sameUnitDirectReports: number;
  totalDirectReports: number;
  directReportsRatio?: number;
  score: number;
};

type Suggestion = {
  id: string;
  orgUnitId: string;
  orgUnitCode: string;
  orgUnitName: string;
  legalEntityId: string;
  suggestedEmployeeId: string;
  suggestedEmployeeName: string;
  suggestedEmployeeNo: string;
  confidenceScore: number;
  confidenceBand: 'HIGH' | 'MEDIUM' | 'LOW';
  reasonCode: string;
  reasonDetails: string;
  runnerUp: RunnerUp | null;
  status: string;
  generatedAt: string;
  reviewedAt: string | null;
  acceptedAt: string | null;
  rejectedAt: string | null;
};

type Metrics = {
  pending: number;
  accepted: number;
  rejected: number;
  stale: number;
  total: number;
  acceptanceRate: number | null;
  confidenceDistribution: { HIGH: number; MEDIUM: number; LOW: number };
  churnRate: number;
};

export default function OrgUnitManagerReview() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [bulkAccepting, setBulkAccepting] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState<'PENDING' | 'ACCEPTED' | 'REJECTED' | 'all'>('PENDING');
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== 'all') params.status = filter;
      const [data, metricsData] = await Promise.all([
        fetchManagerSuggestions(params),
        fetchSuggestionMetrics(),
      ]);
      setSuggestions(Array.isArray(data) ? data : []);
      setMetrics(metricsData);
    } catch { setSuggestions([]); }
    setLoading(false);
  }, [filter]);

  useEffect(() => { void loadSuggestions(); }, [loadSuggestions]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateManagerSuggestions();
      showFeedback(`Generated ${result.generated} suggestion(s). ${result.staled} previous suggestion(s) marked stale.`);
      await loadSuggestions();
    } catch { showFeedback('Failed to generate suggestions.'); }
    setGenerating(false);
  };

  const handleAccept = async (id: string) => {
    setActionInProgress(id);
    try {
      await acceptManagerSuggestion(id);
      await triggerStatsRefresh();
      showFeedback('Suggestion accepted — org unit manager assigned.');
      await loadSuggestions();
    } catch { /* ignore */ }
    setActionInProgress(null);
  };

  const handleReject = async (id: string) => {
    setActionInProgress(id);
    try {
      await rejectManagerSuggestion(id);
      showFeedback('Suggestion rejected.');
      await loadSuggestions();
    } catch { /* ignore */ }
    setActionInProgress(null);
  };

  const handleBulkAccept = async () => {
    const highCount = suggestions.filter((s) => s.confidenceBand === 'HIGH' && s.status === 'PENDING').length;
    if (highCount === 0) return;
    if (!window.confirm(`Accept all ${highCount} HIGH confidence suggestion(s)?`)) return;

    setBulkAccepting(true);
    try {
      const result = await bulkAcceptSuggestions('HIGH');
      await triggerStatsRefresh();
      showFeedback(`Bulk accepted ${result.accepted} suggestion(s).`);
      await loadSuggestions();
    } catch { showFeedback('Bulk accept failed.'); }
    setBulkAccepting(false);
  };

  const bandBadge = (band: string, score: number) => {
    const map: Record<string, { bg: string; fg: string }> = {
      HIGH: { bg: '#dcfce7', fg: '#166534' },
      MEDIUM: { bg: '#fef9c3', fg: '#854d0e' },
      LOW: { bg: '#fee2e2', fg: '#991b1b' },
    };
    const s = map[band] ?? map.LOW;
    return (
      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, background: s.bg, color: s.fg }}>
        {band} ({score}%)
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; fg: string }> = {
      PENDING: { bg: '#dbeafe', fg: '#1e40af' },
      ACCEPTED: { bg: '#dcfce7', fg: '#166534' },
      REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
      STALE: { bg: '#f1f5f9', fg: '#64748b' },
    };
    const s = map[status] ?? map.STALE;
    return (
      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, background: s.bg, color: s.fg }}>
        {status}
      </span>
    );
  };

  const highPending = suggestions.filter((s) => s.confidenceBand === 'HIGH' && s.status === 'PENDING').length;

  return (
    <Page
      title="Org Unit Manager Review"
      subtitle="Review and accept inferred manager suggestions for org units."
      actions={
        <div style={{ display: 'flex', gap: 8 }}>
          {highPending > 0 && (
            <button
              type="button"
              onClick={handleBulkAccept}
              disabled={bulkAccepting}
              style={{
                ...styles.buttonPrimary,
                background: '#16a34a', borderColor: '#16a34a',
                opacity: bulkAccepting ? 0.6 : 1,
              }}
            >
              {bulkAccepting ? 'Accepting...' : `Accept All HIGH (${highPending})`}
            </button>
          )}
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            style={{ ...styles.buttonPrimary, opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating...' : 'Generate Suggestions'}
          </button>
        </div>
      }
    >
      <Stack gap={ui.space.lg}>
        {feedback && <Banner variant="success">{feedback}</Banner>}

        {/* Metrics dashboard */}
        {metrics && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <MetricCard label="Pending" value={metrics.pending} color="#2563eb" bg="#dbeafe" />
            <MetricCard label="Accepted" value={metrics.accepted} color="#166534" bg="#dcfce7" />
            <MetricCard label="Rejected" value={metrics.rejected} color="#991b1b" bg="#fee2e2" />
            <MetricCard
              label="Acceptance Rate"
              value={metrics.acceptanceRate !== null ? `${metrics.acceptanceRate}%` : '—'}
              color="#6366f1" bg="#eef2ff"
            />
            <MetricCard
              label="Confidence"
              value={
                <>
                  <span style={{ color: '#166534' }}>{metrics.confidenceDistribution.HIGH}H</span>{' '}
                  <span style={{ color: '#854d0e' }}>{metrics.confidenceDistribution.MEDIUM}M</span>{' '}
                  <span style={{ color: '#991b1b' }}>{metrics.confidenceDistribution.LOW}L</span>
                </>
              }
              color="#334155" bg="#f8fafc"
            />
            <MetricCard label="Churn Rate" value={`${metrics.churnRate}%`} color="#64748b" bg="#f1f5f9" />
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['PENDING', 'ACCEPTED', 'REJECTED', 'all'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 13, fontWeight: filter === f ? 600 : 400,
                border: `1px solid ${filter === f ? styles.colors.primary : styles.colors.border}`,
                background: filter === f ? '#eef2ff' : 'white',
                color: filter === f ? styles.colors.primary : styles.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              {f === 'all' ? 'All' : f.charAt(0) + f.slice(1).toLowerCase()}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={styles.loadingContainer}>
            <div style={styles.loadingSpinner} />
          </div>
        ) : suggestions.length === 0 ? (
          <Card>
            <div style={{ padding: 40, textAlign: 'center', color: styles.colors.textMuted }}>
              {filter === 'PENDING'
                ? 'No pending suggestions. Click "Generate Suggestions" to analyze org units.'
                : 'No suggestions found for this filter.'}
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader
              title={`${suggestions.length} Suggestion${suggestions.length !== 1 ? 's' : ''}`}
              right={<span style={{ fontSize: 12, color: styles.colors.textMuted }}>Showing: {filter}</span>}
            />
            <div style={{ overflowX: 'auto' }}>
              <table style={styles.table}>
                <thead>
                  <tr style={styles.tableHeader}>
                    <th style={styles.tableHeaderCell}>Org Unit</th>
                    <th style={styles.tableHeaderCell}>Suggested Manager</th>
                    <th style={styles.tableHeaderCell}>Confidence</th>
                    <th style={styles.tableHeaderCell}>Reason</th>
                    <th style={styles.tableHeaderCell}>Status</th>
                    {filter === 'PENDING' && <th style={styles.tableHeaderCell}>Action</th>}
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s) => (
                    <tr key={s.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <div style={{ fontWeight: 600 }}>{s.orgUnitName}</div>
                        <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{s.orgUnitCode}</div>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={{ fontWeight: 500 }}>{s.suggestedEmployeeName}</div>
                        <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{s.suggestedEmployeeNo}</div>
                      </td>
                      <td style={styles.tableCell}>{bandBadge(s.confidenceBand, s.confidenceScore)}</td>
                      <td style={styles.tableCell}>
                        <div style={{ fontSize: 12, color: styles.colors.textSecondary, maxWidth: 280 }}>
                          {s.reasonDetails}
                          {s.runnerUp && (
                            <div style={{ marginTop: 3, fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                              Next closest: {s.runnerUp.employeeName} ({s.runnerUp.sameUnitDirectReports} in-unit, {s.runnerUp.totalDirectReports} total
                              {s.runnerUp.directReportsRatio != null && `, ${Math.round(s.runnerUp.directReportsRatio * 100)}% coverage`})
                            </div>
                          )}
                        </div>
                      </td>
                      <td style={styles.tableCell}>{statusBadge(s.status)}</td>
                      {filter === 'PENDING' && (
                        <td style={styles.tableCell}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => handleAccept(s.id)}
                              disabled={actionInProgress === s.id}
                              style={{
                                padding: '5px 12px', borderRadius: 6, border: '1px solid #22c55e',
                                background: '#f0fdf4', color: '#16a34a', fontSize: 12, fontWeight: 600,
                                cursor: 'pointer', opacity: actionInProgress === s.id ? 0.5 : 1,
                              }}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReject(s.id)}
                              disabled={actionInProgress === s.id}
                              style={{
                                padding: '5px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
                                background: '#f8fafc', color: '#64748b', fontSize: 12, fontWeight: 500,
                                cursor: 'pointer', opacity: actionInProgress === s.id ? 0.5 : 1,
                              }}
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </Stack>
      <style>{styles.spinKeyframes}</style>
    </Page>
  );
}

function MetricCard({ label, value, color, bg }: { label: string; value: React.ReactNode; color: string; bg: string }) {
  return (
    <div style={{
      padding: '12px 16px', borderRadius: 8, background: bg, textAlign: 'center',
      flex: '1 1 120px', minWidth: 100,
    }}>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{label}</div>
    </div>
  );
}
