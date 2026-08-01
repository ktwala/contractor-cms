import { useState, useEffect, useCallback } from 'react';
import * as styles from '../styles/common';
import { Page, Card, CardHeader } from '../ui/layout';
import {
  fetchRemediationApprovals, approveRemediation, rejectRemediation,
  executeApprovedRemediation,
} from '../features/workforce-stats/api';

const ACTION_LABELS: Record<string, string> = {
  BULK_ASSIGN_MANAGER: 'Bulk assign manager',
  BULK_ASSIGN_ORG_UNIT: 'Bulk assign org unit',
  BULK_ASSIGN_COST_CENTER: 'Bulk assign cost center',
  BULK_CREATE_ASSIGNMENTS: 'Bulk create assignments',
  BULK_CREATE_EMPLOYMENTS: 'Bulk create employments',
};

const STATUS_CONFIG: Record<string, { bg: string; fg: string; label: string }> = {
  PENDING: { bg: '#fef9c3', fg: '#854d0e', label: 'Pending' },
  APPROVED: { bg: '#dcfce7', fg: '#166534', label: 'Approved' },
  REJECTED: { bg: '#fee2e2', fg: '#991b1b', label: 'Rejected' },
  EXPIRED: { bg: '#f1f5f9', fg: '#64748b', label: 'Expired' },
  EXECUTED: { bg: '#dbeafe', fg: '#1e40af', label: 'Executed' },
};

export default function RemediationApprovals() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detail, setDetail] = useState<any>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [rejectModal, setRejectModal] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const data = await fetchRemediationApprovals(params);
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await approveRemediation(id);
      showFeedback('success', 'Approval granted. The request can now be executed.');
      load();
      setDetail(null);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to approve';
      showFeedback('error', msg);
    }
    setActionLoading(null);
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    setActionLoading(rejectModal);
    try {
      await rejectRemediation(rejectModal, rejectReason || undefined);
      showFeedback('success', 'Request rejected.');
      setRejectModal(null);
      setRejectReason('');
      load();
      setDetail(null);
    } catch (err: any) {
      showFeedback('error', err?.response?.data?.message || 'Failed to reject');
    }
    setActionLoading(null);
  };

  const handleExecute = async (id: string) => {
    setActionLoading(id);
    try {
      const result = await executeApprovedRemediation(id);
      showFeedback('success', `Executed: ${result?.result?.recordsUpdated ?? 0} records updated.`);
      load();
      setDetail(null);
    } catch (err: any) {
      showFeedback('error', err?.response?.data?.message || 'Execution failed');
    }
    setActionLoading(null);
  };

  const pendingCount = items.filter((i) => i.status === 'PENDING').length;

  const selectStyle: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
    fontSize: 13, background: '#fff', color: '#334155',
  };

  return (
    <Page
      title="Remediation Approvals"
      subtitle="Review, approve, or reject high-impact remediation requests."
    >
      {/* Feedback */}
      {feedback && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600,
          background: feedback.type === 'success' ? '#f0fdf4' : '#fef2f2',
          color: feedback.type === 'success' ? '#166534' : '#991b1b',
          border: `1px solid ${feedback.type === 'success' ? '#bbf7d0' : '#fecaca'}`,
        }}>
          {feedback.message}
        </div>
      )}

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { value: total, label: 'Total requests', color: '#475569' },
          { value: pendingCount, label: 'Pending review', color: pendingCount > 0 ? '#ca8a04' : '#16a34a' },
          { value: items.filter((i) => i.status === 'APPROVED').length, label: 'Approved', color: '#16a34a' },
          { value: items.filter((i) => i.status === 'EXECUTED').length, label: 'Executed', color: '#2563eb' },
        ].map((s, i) => (
          <Card key={i}>
            <div style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <Card>
        <div style={{ padding: '10px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Filter:</span>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={selectStyle}>
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="EXECUTED">Executed</option>
            <option value="EXPIRED">Expired</option>
          </select>
        </div>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader title={`Requests (${items.length})`} />
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No approval requests</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Approval requests appear when bulk operations exceed policy thresholds.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Request</th>
                  <th style={styles.tableHeaderCell}>Records</th>
                  <th style={styles.tableHeaderCell}>Requested By</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Submitted</th>
                  <th style={styles.tableHeaderCell}>Approver</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => {
                  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
                  return (
                    <tr key={item.id} style={styles.tableRow}>
                      <td style={styles.tableCell}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                          {ACTION_LABELS[item.actionType] || item.actionType}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.issueType}</div>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{item.recordsAffected}</span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontSize: 13 }}>
                          {item.requestedBy ? `${item.requestedBy.firstName} ${item.requestedBy.lastName}` : '—'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{
                          padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                          background: sc.bg, color: sc.fg,
                        }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <span style={{ fontSize: 12, color: '#64748b' }}>
                          {item.approver ? `${item.approver.firstName} ${item.approver.lastName}` : '—'}
                        </span>
                      </td>
                      <td style={styles.tableCell}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            onClick={() => setDetail(item)}
                            style={{
                              padding: '4px 10px', borderRadius: 5, border: '1px solid #e2e8f0',
                              background: '#f8fafc', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            }}
                          >
                            View
                          </button>
                          {item.status === 'PENDING' && (
                            <>
                              <button
                                onClick={() => handleApprove(item.id)}
                                disabled={actionLoading === item.id}
                                style={{
                                  padding: '4px 10px', borderRadius: 5, border: '1px solid #16a34a',
                                  background: '#f0fdf4', color: '#16a34a', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                  opacity: actionLoading === item.id ? 0.6 : 1,
                                }}
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => setRejectModal(item.id)}
                                disabled={actionLoading === item.id}
                                style={{
                                  padding: '4px 10px', borderRadius: 5, border: '1px solid #dc2626',
                                  background: '#fef2f2', color: '#dc2626', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                  opacity: actionLoading === item.id ? 0.6 : 1,
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {item.status === 'APPROVED' && (
                            <button
                              onClick={() => handleExecute(item.id)}
                              disabled={actionLoading === item.id}
                              style={{
                                padding: '4px 10px', borderRadius: 5, border: '1px solid #2563eb',
                                background: '#eff6ff', color: '#2563eb', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                                opacity: actionLoading === item.id ? 0.6 : 1,
                              }}
                            >
                              Execute
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
        )}
      </Card>

      {/* Detail panel */}
      {detail && (
        <ApprovalDetailPanel
          item={detail}
          onClose={() => setDetail(null)}
          onApprove={handleApprove}
          onReject={(id) => setRejectModal(id)}
          onExecute={handleExecute}
          actionLoading={actionLoading}
        />
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 420,
            boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>
              Reject Remediation Request
            </div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
              Provide a reason for rejection (optional but recommended).
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection..."
              style={{
                width: '100%', minHeight: 80, padding: 10, borderRadius: 6, border: '1px solid #e2e8f0',
                fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                onClick={() => { setRejectModal(null); setRejectReason(''); }}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
                  background: '#fff', color: '#475569', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading === rejectModal}
                style={{
                  padding: '8px 16px', borderRadius: 6, border: 'none',
                  background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                  opacity: actionLoading === rejectModal ? 0.6 : 1,
                }}
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

function ApprovalDetailPanel({
  item, onClose, onApprove, onReject, onExecute, actionLoading,
}: {
  item: any;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onExecute: (id: string) => void;
  actionLoading: string | null;
}) {
  const sc = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING;
  const fix = (item.fixPayload || {}) as Record<string, unknown>;
  const preview = (item.previewSummary || {}) as Record<string, unknown>;

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, bottom: 0, width: 480, zIndex: 900,
      background: '#fff', borderLeft: '1px solid #e2e8f0', boxShadow: '-10px 0 30px rgba(0,0,0,0.08)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', borderBottom: '1px solid #e2e8f0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0f172a' }}>
            {ACTION_LABELS[item.actionType] || item.actionType}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
            <span style={{
              padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600,
              background: sc.bg, color: sc.fg,
            }}>
              {sc.label}
            </span>
            <span style={{ fontSize: 12, color: '#64748b' }}>
              {item.recordsAffected} records
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}
        >
          &times;
        </button>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        <DetailSection title="Request Details">
          <DetailRow label="Action" value={ACTION_LABELS[item.actionType] || item.actionType} />
          <DetailRow label="Issue Type" value={item.issueType} />
          <DetailRow label="Records Affected" value={item.recordsAffected} />
          <DetailRow label="Submitted" value={new Date(item.createdAt).toLocaleString()} />
          <DetailRow
            label="Requested By"
            value={item.requestedBy ? `${item.requestedBy.firstName} ${item.requestedBy.lastName}` : '—'}
          />
        </DetailSection>

        <DetailSection title="Fix Payload">
          {Object.entries(fix).map(([k, v]) => (
            <DetailRow key={k} label={k.replace(/([A-Z])/g, ' $1')} value={String(v)} />
          ))}
        </DetailSection>

        {item.approver && (
          <DetailSection title="Approval">
            <DetailRow
              label="Approver"
              value={`${item.approver.firstName} ${item.approver.lastName}`}
            />
            {item.approvedAt && (
              <DetailRow label="Approved At" value={new Date(item.approvedAt).toLocaleString()} />
            )}
            {item.rejectedAt && (
              <DetailRow label="Rejected At" value={new Date(item.rejectedAt).toLocaleString()} />
            )}
            {item.rejectionReason && (
              <DetailRow label="Reason" value={item.rejectionReason} />
            )}
          </DetailSection>
        )}

        {item.executedAt && (
          <DetailSection title="Execution">
            <DetailRow label="Executed At" value={new Date(item.executedAt).toLocaleString()} />
          </DetailSection>
        )}

        {Object.keys(preview).length > 0 && (
          <DetailSection title="Preview Summary">
            <pre style={{ fontSize: 11, color: '#475569', background: '#f8fafc', padding: 10, borderRadius: 6, overflowX: 'auto' }}>
              {JSON.stringify(preview, null, 2)}
            </pre>
          </DetailSection>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: '16px 24px', borderTop: '1px solid #e2e8f0', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        {item.status === 'PENDING' && (
          <>
            <button
              onClick={() => onReject(item.id)}
              disabled={actionLoading === item.id}
              style={{
                padding: '8px 20px', borderRadius: 6, border: '1px solid #dc2626',
                background: '#fef2f2', color: '#dc2626', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Reject
            </button>
            <button
              onClick={() => onApprove(item.id)}
              disabled={actionLoading === item.id}
              style={{
                padding: '8px 20px', borderRadius: 6, border: 'none',
                background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Approve
            </button>
          </>
        )}
        {item.status === 'APPROVED' && (
          <button
            onClick={() => onExecute(item.id)}
            disabled={actionLoading === item.id}
            style={{
              padding: '8px 20px', borderRadius: 6, border: 'none',
              background: '#2563eb', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Execute Now
          </button>
        )}
      </div>
    </div>
  );
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: 8 }}>
        {title}
      </div>
      <div style={{ border: '1px solid #f1f5f9', borderRadius: 8, overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', padding: '8px 12px',
      borderBottom: '1px solid #f8fafc', fontSize: 13,
    }}>
      <span style={{ color: '#64748b', fontWeight: 500 }}>{label}</span>
      <span style={{ color: '#0f172a', fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
