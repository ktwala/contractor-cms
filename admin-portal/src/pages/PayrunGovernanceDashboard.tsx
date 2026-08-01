import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner, Stack } from '../ui/layout';

type GovernanceRag = 'GREEN' | 'AMBER' | 'RED' | 'GREY';

type LadderRow = { layer: string; label: string; rag: GovernanceRag; blocked_by?: string };

type Health = {
  payrun_id: string;
  payrun_status: string;
  payrun_type: string;
  closed_period_status: 'OPEN' | 'CLOSED';
  readiness_status: GovernanceRag;
  readiness_percent: number | null;
  financial_control_status: GovernanceRag;
  bank_reconciliation_status: GovernanceRag;
  gl_reconciliation_status: GovernanceRag;
  reversal_status: string;
  post_close_impact_status: string;
  override_count: number;
  override_types: string[];
  unresolved_governance_blocks: string[];
  overall_governance_rag: GovernanceRag;
  ladder: LadderRow[];
};

const RAG_STYLES: Record<GovernanceRag, { bg: string; fg: string }> = {
  GREEN: { bg: '#dcfce7', fg: '#166534' },
  AMBER: { bg: '#fef9c3', fg: '#a16207' },
  RED: { bg: '#fee2e2', fg: '#b91c1c' },
  GREY: { bg: '#f1f5f9', fg: '#475569' },
};

function RagPill({ rag }: { rag: GovernanceRag }) {
  const c = RAG_STYLES[rag] ?? RAG_STYLES.GREY;
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: c.bg, color: c.fg }}>
      {rag}
    </span>
  );
}

export default function PayrunGovernanceDashboard() {
  const { id } = useParams<{ id: string }>();
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/payruns/${id}/governance-health`);
      setHealth(res.data as Health);
    } catch {
      setError('Failed to load governance health');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Page
      title="Governance cockpit"
      subtitle={id ? `Payrun ${id}` : ''}
      breadcrumbs={
        <Stack direction="row" gap={8} style={{ fontSize: 13 }}>
          <Link to="/payroll/payruns" style={{ color: styles.colors.primary }}>Payruns</Link>
          {id && (
            <>
              <span style={{ color: styles.colors.textMuted }}>/</span>
              <Link to={`/payroll/payruns/${id}`} style={{ color: styles.colors.primary }}>Payrun detail</Link>
              <span style={{ color: styles.colors.textMuted }}>/</span>
              <span style={{ color: styles.colors.textMuted }}>Governance</span>
            </>
          )}
        </Stack>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}
      {loading && <Banner variant="info">Loading governance snapshot…</Banner>}
      {health && (
        <>
          <Banner variant={health.overall_governance_rag === 'GREEN' ? 'success' : health.overall_governance_rag === 'RED' ? 'error' : 'warn'}>
            <strong>Overall:</strong> {health.overall_governance_rag} — {health.payrun_type} · {health.payrun_status}
            {' · '}
            Period {health.closed_period_status === 'CLOSED' ? 'closed (GOV-3D)' : 'open'}
          </Banner>

          <Card>
            <CardHeader title="Truth ladder (GOV-2 → GOV-4)" />
            <div style={{ padding: '0 16px 16px' }}>
              <p style={{ fontSize: 13, color: styles.colors.textMuted, marginTop: 0 }}>
                GOV-5A v1 aggregates readiness, 3A/3B/3C, closed period, governed reversal/correction, and post-close impact for supervisory visibility.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {health.ladder.map((row) => (
                  <div
                    key={row.layer}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '100px 1fr auto',
                      gap: 12,
                      alignItems: 'center',
                      padding: 12,
                  borderRadius: 8,
                  border: `1px solid ${styles.colors.border}`,
                  background: '#fff',
                }}
                >
                    <div style={{ fontWeight: 700, fontSize: 12, color: styles.colors.textMuted }}>{row.layer}</div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{row.label}</div>
                      {row.blocked_by && (
                        <div style={{ fontSize: 12, color: styles.colors.textMuted, marginTop: 4 }}>Blocked by: {row.blocked_by}</div>
                      )}
                    </div>
                    <RagPill rag={row.rag} />
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Roll-up fields" />
            <div style={{ padding: '0 16px 16px', fontSize: 13, color: styles.colors.text }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div><span style={{ color: styles.colors.textMuted }}>Readiness</span> <RagPill rag={health.readiness_status} /></div>
                <div><span style={{ color: styles.colors.textMuted }}>3A Financial</span> <RagPill rag={health.financial_control_status} /></div>
                <div><span style={{ color: styles.colors.textMuted }}>3B Bank</span> <RagPill rag={health.bank_reconciliation_status} /></div>
                <div><span style={{ color: styles.colors.textMuted }}>3C GL</span> <RagPill rag={health.gl_reconciliation_status} /></div>
                <div><span style={{ color: styles.colors.textMuted }}>Reversal / correction</span> <code>{health.reversal_status}</code></div>
                <div><span style={{ color: styles.colors.textMuted }}>Post-close impact</span> <code>{health.post_close_impact_status}</code></div>
                <div><span style={{ color: styles.colors.textMuted }}>Overrides (audit)</span> {health.override_count}{health.override_types.length > 0 ? ` — ${health.override_types.join(', ')}` : ''}</div>
                <div><span style={{ color: styles.colors.textMuted }}>Readiness %</span> {health.readiness_percent ?? '—'}</div>
              </div>
            </div>
          </Card>

          {health.unresolved_governance_blocks.length > 0 && (
            <Card>
              <CardHeader title="Unresolved governance blocks" />
              <ul style={{ margin: '0 16px 16px', paddingLeft: 18, fontSize: 13, color: styles.colors.text }}>
                {health.unresolved_governance_blocks.map((b) => (
                  <li key={b} style={{ marginBottom: 6 }}>{b}</li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </Page>
  );
}
