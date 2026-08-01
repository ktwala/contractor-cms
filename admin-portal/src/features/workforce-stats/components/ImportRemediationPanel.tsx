import React, { useEffect, useState, useCallback } from 'react';
import { fetchImportAnalysis } from '../api';
import { ISSUE_TYPE_LABELS } from '../remediation-routes';

interface ImportAnalysis {
  jobId: string;
  datasetType: string;
  status: string;
  recordsPublished: number;
  totalIssues: number;
  issuesDetected: Record<string, number>;
  readinessEstimate: string;
  recommendedActions: { issueType: string; label: string; count: number }[];
}

interface Props {
  jobId: string;
  onFixNow?: (issueType: string) => void;
  initialSnapshot?: ImportAnalysis | null;
}

export const ImportRemediationPanel: React.FC<Props> = ({ jobId, onFixNow, initialSnapshot }) => {
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(initialSnapshot ?? null);
  const [loading, setLoading] = useState(!initialSnapshot);
  const [initial, setInitial] = useState<ImportAnalysis | null>(initialSnapshot ?? null);

  const load = useCallback(async () => {
    if (!jobId) return;
    setLoading(true);
    try {
      const data = await fetchImportAnalysis(jobId);
      if (!initial) setInitial(data);
      setAnalysis(data);
    } catch {
      setAnalysis(null);
    }
    setLoading(false);
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#94a3b8', fontSize: 13 }}>
        Analyzing import results...
      </div>
    );
  }

  if (!analysis || analysis.totalIssues === 0) {
    return (
      <div style={{ padding: 16, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#166534' }}>
          Import complete — no issues detected
        </div>
        <div style={{ fontSize: 12, color: '#15803d', marginTop: 2 }}>
          Readiness estimate: {analysis?.readinessEstimate ?? '100%'}
        </div>
      </div>
    );
  }

  const initialTotal = initial?.totalIssues ?? analysis.totalIssues;
  const resolved = Math.max(0, initialTotal - analysis.totalIssues);
  const remaining = analysis.totalIssues;

  return (
    <div style={{ borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', background: '#fefce8', borderBottom: '1px solid #fde68a' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#854d0e' }}>
          Onboarding Analysis
        </div>
        <div style={{ fontSize: 13, color: '#92400e', marginTop: 2 }}>
          {analysis.recordsPublished} records published · {analysis.totalIssues} issue{analysis.totalIssues !== 1 ? 's' : ''} detected · Readiness: {analysis.readinessEstimate}
        </div>
      </div>

      {/* Fix Progress */}
      {initialTotal > 0 && (
        <div style={{ padding: '12px 20px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#166534', marginBottom: 6 }}>Fix Progress</div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#64748b' }}>{initialTotal}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Initial</div>
            </div>
            <div style={{ fontSize: 16, color: '#94a3b8' }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#16a34a' }}>{resolved}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Resolved</div>
            </div>
            <div style={{ fontSize: 16, color: '#94a3b8' }}>→</div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: remaining > 0 ? '#dc2626' : '#16a34a' }}>{remaining}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Remaining</div>
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#2563eb' }}>{analysis.readinessEstimate}</div>
              <div style={{ fontSize: 10, color: '#94a3b8' }}>Readiness</div>
            </div>
            <button
              onClick={load}
              style={{
                padding: '4px 12px', borderRadius: 6, border: '1px solid #16a34a',
                background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Refresh
            </button>
          </div>
          {initialTotal > 0 && (
            <div style={{ marginTop: 8, height: 6, borderRadius: 3, background: '#e2e8f0', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 3,
                background: '#16a34a',
                width: `${Math.round((resolved / initialTotal) * 100)}%`,
                transition: 'width 0.3s',
              }} />
            </div>
          )}
        </div>
      )}

      {/* Issue summary */}
      <div style={{ padding: '0' }}>
        {analysis.recommendedActions.map((action) => (
          <div
            key={action.issueType}
            style={{
              padding: '12px 20px', borderBottom: '1px solid #f1f5f9',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                {ISSUE_TYPE_LABELS[action.issueType] || action.label}
              </div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                {action.count} employee{action.count !== 1 ? 's' : ''} affected
              </div>
            </div>
            <button
              onClick={() => onFixNow?.(action.issueType)}
              style={{
                padding: '5px 14px', borderRadius: 6, border: '1px solid #6366f1',
                background: '#eef2ff', color: '#4338ca', fontSize: 12, fontWeight: 600,
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              Fix now
            </button>
          </div>
        ))}
      </div>

      {/* Dataset health */}
      <div style={{ padding: '12px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>Dataset health</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <DatasetPill label="Employees" status={analysis.issuesDetected.missingManager === 0 ? 'complete' : 'partial'} />
          <DatasetPill label="Employments" status={(analysis.issuesDetected.employeeWithoutEmployment ?? 0) > 0 ? 'missing' : 'complete'} />
          <DatasetPill label="Assignments" status={(analysis.issuesDetected.missingOrgAssignment ?? 0) > 0 || (analysis.issuesDetected.employeeWithoutAssignment ?? 0) > 0 ? 'partial' : 'complete'} />
          <DatasetPill label="Managers" status={analysis.issuesDetected.missingManager > 0 ? 'incomplete' : 'complete'} />
          <DatasetPill label="Cost Centers" status={(analysis.issuesDetected.missingCostCenter ?? 0) > 0 ? 'partial' : 'complete'} />
        </div>
      </div>
    </div>
  );
};

function DatasetPill({ label, status }: { label: string; status: 'complete' | 'partial' | 'incomplete' | 'missing' }) {
  const pillStyles: Record<string, { bg: string; fg: string }> = {
    complete: { bg: '#dcfce7', fg: '#166534' },
    partial: { bg: '#fef9c3', fg: '#854d0e' },
    incomplete: { bg: '#fed7aa', fg: '#9a3412' },
    missing: { bg: '#fee2e2', fg: '#991b1b' },
  };
  const s = pillStyles[status];
  return (
    <span style={{
      padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
      background: s.bg, color: s.fg, textTransform: 'uppercase',
    }}>
      {label}: {status}
    </span>
  );
}
