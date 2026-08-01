import { useState, useEffect, useCallback } from 'react';
import * as styles from '../styles/common';
import { Page, Card, CardHeader } from '../ui/layout';
import { fetchBulkRemediationHistory } from '../features/workforce-stats/api';
import { ISSUE_TYPE_LABELS } from '../features/workforce-stats/remediation-routes';

const ACTION_LABELS: Record<string, string> = {
  BULK_ASSIGN_MANAGER: 'Bulk assign manager',
  BULK_ASSIGN_ORG_UNIT: 'Bulk assign org unit',
  BULK_ASSIGN_COST_CENTER: 'Bulk assign cost center',
  BULK_CREATE_ASSIGNMENTS: 'Bulk create assignments',
  BULK_CREATE_EMPLOYMENTS: 'Bulk create employments',
};

export default function BulkRemediationHistory() {
  const [items, setItems] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { limit: 100 };
      if (actionFilter) params.actionType = actionFilter;
      const data = await fetchBulkRemediationHistory(params);
      setItems(data?.items ?? []);
      setTotal(data?.total ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }, [actionFilter]);

  useEffect(() => { load(); }, [load]);

  const totalRecords = items.reduce((s: number, i: any) => s + (i.recordsAffected || 0), 0);
  const actionTypes = new Set(items.map((i: any) => i.actionType));

  const actionBadge = (type: string) => {
    const colorMap: Record<string, { bg: string; fg: string }> = {
      BULK_ASSIGN_MANAGER: { bg: '#dbeafe', fg: '#1e40af' },
      BULK_ASSIGN_ORG_UNIT: { bg: '#dcfce7', fg: '#166534' },
      BULK_ASSIGN_COST_CENTER: { bg: '#fef9c3', fg: '#854d0e' },
      BULK_CREATE_ASSIGNMENTS: { bg: '#e0e7ff', fg: '#3730a3' },
      BULK_CREATE_EMPLOYMENTS: { bg: '#fce7f3', fg: '#9d174d' },
    };
    const c = colorMap[type] || { bg: '#f1f5f9', fg: '#475569' };
    return (
      <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, background: c.bg, color: c.fg }}>
        {ACTION_LABELS[type] || type}
      </span>
    );
  };

  const formatFix = (fix: Record<string, unknown>) => {
    return Object.entries(fix || {})
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${v}`)
      .join(', ');
  };

  const selectStyle: React.CSSProperties = {
    padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
    fontSize: 13, background: '#fff', color: '#334155',
  };

  return (
    <Page
      title="Bulk Remediation History"
      subtitle="Audit trail of all bulk data quality operations."
    >
      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#2563eb' }}>{total}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Total bulk actions</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{totalRecords}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Total records fixed</div>
          </div>
        </Card>
        <Card>
          <div style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#8b5cf6' }}>{actionTypes.size}</div>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Action types used</div>
          </div>
        </Card>
      </div>

      {/* Filter */}
      <Card>
        <div style={{ padding: '10px 20px', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>Filter:</span>
          <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={selectStyle}>
            <option value="">All action types</option>
            {Object.entries(ACTION_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </Card>

      {/* History table */}
      <Card>
        <CardHeader title={`Actions (${items.length})`} />
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>Loading history...</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#64748b' }}>No bulk actions recorded</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>
              Bulk remediation actions will appear here after being applied.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Time</th>
                  <th style={styles.tableHeaderCell}>Action</th>
                  <th style={styles.tableHeaderCell}>Issue Type</th>
                  <th style={styles.tableHeaderCell}>Records</th>
                  <th style={styles.tableHeaderCell}>Legal Entity</th>
                  <th style={styles.tableHeaderCell}>Org Unit</th>
                  <th style={styles.tableHeaderCell}>Fix Applied</th>
                  <th style={styles.tableHeaderCell}>User</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item: any) => (
                  <tr key={item.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>
                      <div style={{ fontSize: 13 }}>{new Date(item.executedAt).toLocaleDateString()}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8' }}>{new Date(item.executedAt).toLocaleTimeString()}</div>
                    </td>
                    <td style={styles.tableCell}>{actionBadge(item.actionType)}</td>
                    <td style={styles.tableCell}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>
                        {ISSUE_TYPE_LABELS[item.issueType] || item.issueType}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{item.recordsAffected}</span>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ fontSize: 12, color: '#475569' }}>{item.legalEntityName || '—'}</span>
                    </td>
                    <td style={styles.tableCell}>
                      <span style={{ fontSize: 12, color: '#475569' }}>{item.orgUnitName || '—'}</span>
                    </td>
                    <td style={{ ...styles.tableCell, maxWidth: 200 }}>
                      <span style={{ fontSize: 12, color: '#64748b', wordBreak: 'break-all' }}>
                        {formatFix(item.fixPayload || {})}
                      </span>
                    </td>
                    <td style={styles.tableCell}>
                      <div style={{ fontSize: 13 }}>{item.userName}</div>
                      {item.userEmail && (
                        <div style={{ fontSize: 11, color: '#94a3b8' }}>{item.userEmail}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}
