import React, { useState } from 'react';
import * as styles from '../../../styles/common';

interface PolicyCheck {
  requiresApproval: boolean;
  reason?: string;
}

interface PreviewData {
  recordsAffected: number;
  employees: { employeeId: string; employeeName: string; employeeNo: string; orgUnitName?: string }[];
  changesPreview: { field: string; label: string; oldValue: unknown; newValue: unknown; newValueLabel?: string };
  expectedImpact: { issuesResolved: number; exportBlockersReduced: number; readinessDeltaEstimate: string };
  policyCheck?: PolicyCheck;
}

interface Props {
  open: boolean;
  preview: PreviewData | null;
  issueTypeLabel: string;
  applying: boolean;
  onApply: () => void;
  onRequestApproval?: () => void;
  onClose: () => void;
}

export const BulkRemediationPreviewModal: React.FC<Props> = ({
  open, preview, issueTypeLabel, applying, onApply, onRequestApproval, onClose,
}) => {
  const [confirmed, setConfirmed] = useState(false);

  if (!open || !preview) return null;

  const needsApproval = preview.policyCheck?.requiresApproval === true;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1200,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }} onClick={onClose} />
      <div style={{
        position: 'relative', background: '#fff', borderRadius: 12, padding: 0,
        width: 560, maxWidth: '90vw', maxHeight: '85vh', overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a' }}>
            Bulk Remediation Preview
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 2 }}>
            {issueTypeLabel} — {preview.recordsAffected} record{preview.recordsAffected !== 1 ? 's' : ''} affected
          </div>
        </div>

        {/* Change summary */}
        <div style={{ padding: '16px 24px', background: '#f0fdf4', borderBottom: '1px solid #dcfce7' }}>
          <div style={{ fontSize: 12, color: '#166534', fontWeight: 600, marginBottom: 4 }}>Change</div>
          <div style={{ fontSize: 14, color: '#0f172a' }}>
            <strong>{preview.changesPreview.label}:</strong>{' '}
            {preview.changesPreview.newValueLabel || String(preview.changesPreview.newValue)}
          </div>
        </div>

        {/* Impact estimate */}
        <div style={{
          padding: '12px 24px', display: 'flex', gap: 16, borderBottom: '1px solid #f1f5f9',
          background: '#f8fafc',
        }}>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#16a34a' }}>{preview.expectedImpact.issuesResolved}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Issues resolved</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#dc2626' }}>{preview.expectedImpact.exportBlockersReduced}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Blockers reduced</div>
          </div>
          <div style={{ textAlign: 'center', flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#2563eb' }}>{preview.expectedImpact.readinessDeltaEstimate}</div>
            <div style={{ fontSize: 11, color: '#64748b' }}>Readiness delta</div>
          </div>
        </div>

        {/* Employee list */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0' }}>
          <div style={{ padding: '12px 24px 4px', fontSize: 12, fontWeight: 600, color: '#64748b' }}>
            Affected employees ({preview.employees.length})
          </div>
          {preview.employees.map((emp) => (
            <div key={emp.employeeId} style={{
              padding: '8px 24px', borderBottom: '1px solid #f8fafc',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#0f172a' }}>{emp.employeeName}</div>
                <div style={{ fontSize: 11, color: '#94a3b8' }}>{emp.employeeNo}</div>
              </div>
              {emp.orgUnitName && (
                <div style={{ fontSize: 11, color: '#64748b' }}>{emp.orgUnitName}</div>
              )}
            </div>
          ))}
        </div>

        {/* Policy warning */}
        {needsApproval && (
          <div style={{
            padding: '10px 24px', background: '#fefce8', borderTop: '1px solid #fde68a',
            fontSize: 13, color: '#854d0e', fontWeight: 500,
          }}>
            Governance policy requires approval for this operation. {preview.policyCheck?.reason}
          </div>
        )}

        {/* Footer */}
        <div style={{
          padding: '16px 24px', borderTop: '1px solid #e2e8f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#475569' }}>
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
            I confirm this bulk change
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ ...styles.buttonSecondary, fontSize: 13, padding: '8px 16px' }}
            >
              Cancel
            </button>
            {needsApproval ? (
              <button
                type="button"
                onClick={onRequestApproval}
                disabled={!confirmed || applying}
                style={{
                  ...styles.buttonPrimary, fontSize: 13, padding: '8px 20px',
                  background: confirmed ? '#ca8a04' : '#94a3b8',
                  borderColor: confirmed ? '#ca8a04' : '#94a3b8',
                  opacity: applying ? 0.6 : 1,
                }}
              >
                {applying ? 'Submitting...' : 'Request Approval'}
              </button>
            ) : (
              <button
                type="button"
                onClick={onApply}
                disabled={!confirmed || applying}
                style={{
                  ...styles.buttonPrimary, fontSize: 13, padding: '8px 20px',
                  background: confirmed ? '#16a34a' : '#94a3b8',
                  borderColor: confirmed ? '#16a34a' : '#94a3b8',
                  opacity: applying ? 0.6 : 1,
                }}
              >
                {applying ? 'Applying...' : `Apply to ${preview.recordsAffected} records`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
