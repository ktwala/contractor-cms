import React, { useState } from 'react';
import { MessageSquare, Send, Shield, AlertTriangle, XCircle } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';

type ReviewStatus = 'REVIEWED' | 'ACCEPTED' | 'CONCERNS_RAISED' | 'REJECTED';

const STATUS_OPTIONS: { value: ReviewStatus; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'ACCEPTED', label: 'Accept', icon: <Shield size={14} />, color: '#059669' },
  { value: 'REVIEWED', label: 'Mark Reviewed', icon: <MessageSquare size={14} />, color: '#3b82f6' },
  { value: 'CONCERNS_RAISED', label: 'Raise Concerns', icon: <AlertTriangle size={14} />, color: '#f59e0b' },
  { value: 'REJECTED', label: 'Reject', icon: <XCircle size={14} />, color: '#dc2626' },
];

interface Props {
  runId?: string | null;
  latestReviewStatus?: string | null;
  stale?: boolean;
  onSubmit: (payload: { reviewStatus: ReviewStatus; reviewComment?: string }) => Promise<void>;
  disabled?: boolean;
}

export function ImpactAnalysisReviewPanel({ runId, latestReviewStatus, stale, onSubmit, disabled }: Props) {
  const [selectedStatus, setSelectedStatus] = useState<ReviewStatus>('ACCEPTED');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!runId) {
    return (
      <Card>
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: 16, fontSize: 13 }}>
          No impact analysis run available for review.
        </div>
      </Card>
    );
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        reviewStatus: selectedStatus,
        reviewComment: comment.trim() || undefined,
      });
      setComment('');
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e.message ?? 'Review submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  const isDisabled = disabled || submitting;

  return (
    <Card>
      <div style={{ ...styles.cardHeader, marginBottom: 12 }}>
        <div style={{ ...styles.cardTitle, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Shield size={16} style={{ color: '#4f46e5' }} />
          Sign-off / Review
        </div>
      </div>

      {stale && selectedStatus === 'ACCEPTED' && (
        <div style={{ fontSize: 13, color: '#92400e', background: '#fffbeb', padding: '8px 12px', borderRadius: 8, border: '1px solid #fde68a', marginBottom: 12 }}>
          <AlertTriangle size={13} style={{ verticalAlign: -2, marginRight: 4 }} />
          This run is stale — accepting is blocked until a fresh run is performed.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: '#991b1b', background: '#fee2e2', padding: '8px 12px', borderRadius: 8, border: '1px solid #fecaca', marginBottom: 12 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {STATUS_OPTIONS.map((opt) => {
          const isSelected = selectedStatus === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => setSelectedStatus(opt.value)}
              disabled={isDisabled}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                fontSize: 13,
                fontWeight: isSelected ? 600 : 400,
                border: `1.5px solid ${isSelected ? opt.color : '#e2e8f0'}`,
                borderRadius: 8,
                background: isSelected ? `${opt.color}10` : '#fff',
                color: isSelected ? opt.color : '#64748b',
                cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: isDisabled ? 0.5 : 1,
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ ...styles.formLabel, fontSize: 12 }}>Comment (optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={2000}
          rows={3}
          disabled={isDisabled}
          placeholder="Add a review comment…"
          style={{
            ...styles.formInput,
            resize: 'vertical',
            minHeight: 60,
            fontFamily: 'inherit',
          }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleSubmit}
          disabled={isDisabled}
          style={{
            ...styles.buttonPrimary,
            padding: '8px 20px',
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            opacity: isDisabled ? 0.5 : 1,
          }}
        >
          <Send size={13} />
          {submitting ? 'Submitting…' : 'Submit Review'}
        </button>
      </div>

      {latestReviewStatus && (
        <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 8, textAlign: 'right' }}>
          Current review status: <strong>{latestReviewStatus.replace(/_/g, ' ')}</strong>
        </div>
      )}
    </Card>
  );
}
