import React from 'react';
import { Download, Eye, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import type { ImpactAnalysisRunItem } from '../../hooks/useImpactAnalysisRuns';

const REVIEW_COLORS: Record<string, { text: string; bg: string }> = {
  ACCEPTED: { text: '#065f46', bg: '#d1fae5' },
  REVIEWED: { text: '#1e40af', bg: '#dbeafe' },
  CONCERNS_RAISED: { text: '#92400e', bg: '#fef3c7' },
  REJECTED: { text: '#991b1b', bg: '#fee2e2' },
};

interface Props {
  runs: ImpactAnalysisRunItem[];
  onExport: (runId: string) => void;
  onSelect?: (runId: string) => void;
  staleChecker?: (run: ImpactAnalysisRunItem) => boolean;
}

export function ImpactAnalysisRunHistory({ runs, onExport, onSelect, staleChecker }: Props) {
  if (runs.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16, fontSize: 13 }}>
          No impact analysis runs yet. Run an analysis to create persisted records.
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ ...styles.cardHeader, marginBottom: 12 }}>
        <div style={{ ...styles.cardTitle, fontSize: 14 }}>Run History</div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ ...styles.table, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Analyzed</th>
              <th style={styles.th}>Affected</th>
              <th style={styles.th}>Total Delta</th>
              <th style={styles.th}>Review</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => {
              const latestReview = run.reviews?.[0];
              const reviewStatus = latestReview?.reviewStatus;
              const isStale = staleChecker ? staleChecker(run) : false;
              const reviewStyle = reviewStatus ? REVIEW_COLORS[reviewStatus] : null;

              return (
                <tr key={run.id} style={{ ...styles.tr, background: isStale ? '#fffbeb' : undefined }}>
                  <td style={styles.td}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={12} style={{ color: '#94a3b8' }} />
                      {new Date(run.runAt).toLocaleString()}
                    </span>
                  </td>
                  <td style={styles.td}>{run.employeesAnalyzed}</td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: run.employeesAffected > 0 ? 600 : 400, color: run.employeesAffected > 0 ? '#4f46e5' : '#94a3b8' }}>
                      {run.employeesAffected}
                    </span>
                  </td>
                  <td style={styles.td}>
                    <span style={{ fontWeight: 500, color: Number(run.totalPayeDelta) > 0 ? '#dc2626' : Number(run.totalPayeDelta) < 0 ? '#059669' : '#94a3b8' }}>
                      {Number(run.totalPayeDelta).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td style={styles.td}>
                    {reviewStyle && reviewStatus ? (
                      <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, color: reviewStyle.text, background: reviewStyle.bg }}>
                        {reviewStatus.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                    )}
                  </td>
                  <td style={styles.td}>
                    {isStale ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#f59e0b' }}>
                        <AlertTriangle size={11} /> Stale
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: '#10b981' }}>
                        <CheckCircle size={11} /> Fresh
                      </span>
                    )}
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        onClick={() => onExport(run.id)}
                        title="Export CSV"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#4f46e5', padding: 2 }}
                      >
                        <Download size={14} />
                      </button>
                      {onSelect && (
                        <button
                          onClick={() => onSelect(run.id)}
                          title="View details"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 2 }}
                        >
                          <Eye size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
