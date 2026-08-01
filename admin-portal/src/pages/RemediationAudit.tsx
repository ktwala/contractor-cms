import { useState, useEffect, useCallback } from 'react';
import { Page, Card } from '../ui/layout';
import { fetchGovernanceAuditTrail } from '../features/workforce-stats/api';

const EVENT_CONFIG: Record<string, { bg: string; fg: string; icon: string; label: string }> = {
  REMEDIATION_APPROVAL_REQUESTED: { bg: '#fef9c3', fg: '#854d0e', icon: '📋', label: 'Approval Requested' },
  REMEDIATION_APPROVED: { bg: '#dcfce7', fg: '#166534', icon: '✓', label: 'Approved' },
  REMEDIATION_REJECTED: { bg: '#fee2e2', fg: '#991b1b', icon: '✕', label: 'Rejected' },
  REMEDIATION_EXECUTED: { bg: '#dbeafe', fg: '#1e40af', icon: '⚡', label: 'Executed' },
  REMEDIATION_EXPIRED: { bg: '#f1f5f9', fg: '#64748b', icon: '⏱', label: 'Expired' },
  ISSUE_ASSIGNED: { bg: '#e0e7ff', fg: '#3730a3', icon: '→', label: 'Issue Assigned' },
  ISSUE_UNASSIGNED: { bg: '#f1f5f9', fg: '#64748b', icon: '←', label: 'Issue Unassigned' },
  ISSUE_DISMISSED: { bg: '#fef9c3', fg: '#854d0e', icon: '✗', label: 'Issue Dismissed' },
  ISSUE_REOPENED: { bg: '#fed7aa', fg: '#9a3412', icon: '↺', label: 'Issue Reopened' },
  BULK_REMEDIATION: { bg: '#e0e7ff', fg: '#3730a3', icon: '⚙', label: 'Bulk Remediation' },
};

const ACTION_LABELS: Record<string, string> = {
  BULK_ASSIGN_MANAGER: 'Bulk assign manager',
  BULK_ASSIGN_ORG_UNIT: 'Bulk assign org unit',
  BULK_ASSIGN_COST_CENTER: 'Bulk assign cost center',
  BULK_CREATE_ASSIGNMENTS: 'Bulk create assignments',
  BULK_CREATE_EMPLOYMENTS: 'Bulk create employments',
};

export default function RemediationAudit() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchGovernanceAuditTrail({ limit: 200 });
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const eventsByDate = items.reduce<Record<string, any[]>>((acc, item) => {
    const date = new Date(item.createdAt).toLocaleDateString();
    if (!acc[date]) acc[date] = [];
    acc[date].push(item);
    return acc;
  }, {});

  const summaryStats = {
    requested: items.filter((i) => i.event === 'REMEDIATION_APPROVAL_REQUESTED').length,
    approved: items.filter((i) => i.event === 'REMEDIATION_APPROVED').length,
    rejected: items.filter((i) => i.event === 'REMEDIATION_REJECTED').length,
    executed: items.filter((i) => i.event === 'REMEDIATION_EXECUTED' || i.event === 'BULK_REMEDIATION').length,
  };

  return (
    <Page
      title="Remediation Audit Trail"
      subtitle="Complete evidence trail of all governance decisions and remediation actions."
    >
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { value: total, label: 'Total events', color: '#475569' },
          { value: summaryStats.requested, label: 'Requests', color: '#ca8a04' },
          { value: summaryStats.approved, label: 'Approved', color: '#16a34a' },
          { value: summaryStats.rejected, label: 'Rejected', color: '#dc2626' },
          { value: summaryStats.executed, label: 'Executed', color: '#2563eb' },
        ].map((s, i) => (
          <Card key={i}>
            <div style={{ padding: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{s.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {loading ? (
        <Card>
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading audit trail...</div>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No audit events yet</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Governance and remediation events will appear here.
            </div>
          </div>
        </Card>
      ) : (
        <>
          {/* Timeline view */}
          {Object.entries(eventsByDate).map(([date, dateItems]) => (
            <Card key={date}>
              <div style={{ padding: '10px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>{date}</span>
                <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 8 }}>
                  {dateItems.length} event{dateItems.length !== 1 ? 's' : ''}
                </span>
              </div>
              {dateItems.map((item: any, idx: number) => {
                const cfg = EVENT_CONFIG[item.event] || { bg: '#f1f5f9', fg: '#475569', icon: '•', label: item.event };
                const detail = item.detail || {};
                return (
                  <div
                    key={item.id}
                    style={{
                      padding: '12px 20px',
                      borderBottom: idx < dateItems.length - 1 ? '1px solid #f1f5f9' : 'none',
                      display: 'flex', gap: 12, alignItems: 'flex-start',
                    }}
                  >
                    {/* Timeline dot */}
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                      background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, marginTop: 2,
                    }}>
                      {cfg.icon}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                        <span style={{
                          padding: '1px 8px', borderRadius: 999, fontSize: 10, fontWeight: 600,
                          background: cfg.bg, color: cfg.fg,
                        }}>
                          {cfg.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#94a3b8' }}>
                          {new Date(item.createdAt).toLocaleTimeString()}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: '#0f172a', fontWeight: 500 }}>
                        {detail.actionType ? (ACTION_LABELS[detail.actionType] || detail.actionType) : item.entityType}
                        {detail.recordsAffected && (
                          <span style={{ color: '#64748b', fontWeight: 400 }}>
                            {' '}— {detail.recordsAffected} records
                          </span>
                        )}
                        {detail.recordsUpdated && (
                          <span style={{ color: '#64748b', fontWeight: 400 }}>
                            {' '}— {detail.recordsUpdated} records updated
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        by {item.userName}
                        {detail.approvedBy && <span> (approved)</span>}
                        {detail.rejectedBy && <span> (rejected)</span>}
                        {detail.reason && <span> — "{detail.reason}"</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </Card>
          ))}
        </>
      )}
    </Page>
  );
}
