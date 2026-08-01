import React from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock, Info } from 'lucide-react';
import { Card } from '../../../../ui/layout';
import type { LatestReviewInfo } from '../../hooks/useImpactAnalysisRuns';

const REASON_LABELS: Record<string, string> = {
  TTA_IMPACT_PUBLISH_REQUIRES_RUN: 'Run impact analysis before publishing.',
  TTA_IMPACT_PUBLISH_REQUIRES_ACCEPTED_REVIEW: 'An accepted impact review is required before publishing.',
  TTA_IMPACT_PUBLISH_RUN_STALE: 'The latest impact analysis is outdated because the draft changed or the analysis expired.',
};

const REVIEW_STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  REVIEWED: { label: 'Reviewed', color: '#1e40af', bg: '#dbeafe' },
  ACCEPTED: { label: 'Accepted', color: '#065f46', bg: '#d1fae5' },
  CONCERNS_RAISED: { label: 'Concerns Raised', color: '#92400e', bg: '#fef3c7' },
  REJECTED: { label: 'Rejected', color: '#991b1b', bg: '#fee2e2' },
};

interface Props {
  latest: LatestReviewInfo | null;
}

export function ImpactAnalysisStatusCard({ latest }: Props) {
  if (!latest) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8', fontSize: 13 }}>
          <Info size={16} />
          No impact analysis data available yet.
        </div>
      </Card>
    );
  }

  const { allowed, stale, reason, latestRunId, latestReviewStatus, latestRunAt, latestReviewComment, latestReviewedAt } = latest as any;

  const statusIcon = allowed
    ? <CheckCircle size={18} style={{ color: '#10b981', flexShrink: 0 }} />
    : stale
      ? <AlertTriangle size={18} style={{ color: '#f59e0b', flexShrink: 0 }} />
      : <XCircle size={18} style={{ color: '#ef4444', flexShrink: 0 }} />;

  const statusLabel = allowed ? 'Publish readiness: OK' : 'Publish readiness: Blocked';
  const statusColor = allowed ? '#065f46' : '#991b1b';

  const reviewBadge = latestReviewStatus
    ? REVIEW_STATUS_LABELS[latestReviewStatus] ?? { label: latestReviewStatus, color: '#374151', bg: '#f3f4f6' }
    : null;

  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {statusIcon}
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: statusColor, marginBottom: 4 }}>
            {statusLabel}
          </div>

          {reason && (
            <div style={{ fontSize: 13, color: '#92400e', marginBottom: 8 }}>
              {REASON_LABELS[reason] ?? reason}
            </div>
          )}

          {stale && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b', background: '#fffbeb', padding: '2px 8px', borderRadius: 4, marginBottom: 8 }}>
              <AlertTriangle size={12} /> Stale
            </div>
          )}

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#64748b' }}>
            {latestRunId && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Clock size={12} />
                Last run: {latestRunAt ? new Date(latestRunAt).toLocaleString() : latestRunId.slice(0, 8) + '…'}
              </span>
            )}
            {reviewBadge && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 8px',
                  borderRadius: 4,
                  fontSize: 12,
                  fontWeight: 500,
                  color: reviewBadge.color,
                  background: reviewBadge.bg,
                }}
              >
                {reviewBadge.label}
              </span>
            )}
          </div>

          {latestReviewComment && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 6, fontStyle: 'italic' }}>
              &ldquo;{latestReviewComment}&rdquo;
              {latestReviewedAt && (
                <span style={{ marginLeft: 6 }}>— {new Date(latestReviewedAt).toLocaleString()}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
