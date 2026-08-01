import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, Banner } from '../ui/layout';
import { classifyPageState } from '../utils/pageState';
import { usePageStateTelemetry } from '../utils/pageStateTelemetry';
import { PageStateView } from '../ui/PageStateViews';
import { P } from '../constants/permissions';

type Detail = {
  id: string;
  label: string;
  tax_year_start: string;
  tax_year_end: string;
  status: string;
  pay_group: {
    id: string;
    code: string;
    name: string;
    country: string;
    frequency: string;
  };
  legal_entity: { id: string; code: string; name: string };
  periods_total: number;
  periods: Array<{
    id: string;
    start_date: string;
    end_date: string;
    pay_date: string;
    year: number;
    period_num: number;
    closed_at: string | null;
  }>;
};

type LifecycleBlocker = { code: string; message: string };

type LifecycleEligibility = {
  status: string;
  can_close: boolean;
  can_archive: boolean;
  close_blockers: LifecycleBlocker[];
  archive_blockers: LifecycleBlocker[];
  counts: {
    linked_periods: number;
    periods_closed: number;
    active_payruns: number;
    activity_payruns: number;
  };
};

const STATUS_STYLE: Record<string, { bg: string; fg: string }> = {
  PLANNING: { bg: '#f1f5f9', fg: '#475569' },
  ACTIVE: { bg: '#dcfce7', fg: '#15803d' },
  CLOSED: { bg: '#fef9c3', fg: '#a16207' },
  ARCHIVED: { bg: '#f1f5f9', fg: '#64748b' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLE[status] ?? { bg: '#f1f5f9', fg: '#475569' };
  return (
    <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: s.bg, color: s.fg }}>
      {status}
    </span>
  );
}

function parseLifecycleActionError(e: unknown): { message: string; blockers: LifecycleBlocker[] } {
  const ax = e as { response?: { data?: Record<string, unknown> } };
  const d = ax.response?.data;
  const message =
    typeof d?.message === 'string'
      ? d.message
      : typeof d === 'string'
        ? d
        : 'Request failed';
  const raw = d?.blockers;
  const blockers: LifecycleBlocker[] = Array.isArray(raw)
    ? raw.filter((b): b is LifecycleBlocker => b != null && typeof (b as LifecycleBlocker).message === 'string')
    : [];
  return { message, blockers };
}

export default function PayrollContainerDetail() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAccess();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [lifecycle, setLifecycle] = useState<LifecycleEligibility | null>(null);
  const [lifecycleLoadError, setLifecycleLoadError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);

  const [lifecycleModal, setLifecycleModal] = useState<'close' | 'archive' | null>(null);
  const [lifecycleReason, setLifecycleReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionErrorBlockers, setActionErrorBlockers] = useState<LifecycleBlocker[]>([]);

  const canView = can('pay_group:read');
  const canClosePerm = can(P.PAYROLL_CONTAINERS_CLOSE);
  const canArchivePerm = can(P.PAYROLL_CONTAINERS_ARCHIVE);

  const load = useCallback(async () => {
    if (!canView) return;
    if (!id) {
      setLoading(false);
      setLoadError(null);
      setDetail(null);
      setLifecycle(null);
      setLifecycleLoadError(null);
      return;
    }
    try {
      setLoading(true);
      setLoadError(null);
      setLifecycleLoadError(null);

      const [detailResult, lifeResult] = await Promise.allSettled([
        api.get(`/payrolls/${id}`),
        api.get(`/payrolls/${id}/lifecycle-eligibility`),
      ]);

      if (detailResult.status === 'rejected') {
        setLoadError(detailResult.reason);
        setDetail(null);
        setLifecycle(null);
      } else {
        setDetail(detailResult.value.data as Detail);
        setLoadError(null);
      }

      if (lifeResult.status === 'fulfilled') {
        setLifecycle(lifeResult.value.data as LifecycleEligibility);
        setLifecycleLoadError(null);
      } else {
        setLifecycle(null);
        setLifecycleLoadError(lifeResult.reason);
      }
    } catch (e) {
      setLoadError(e);
      setDetail(null);
      setLifecycle(null);
    } finally {
      setLoading(false);
    }
  }, [canView, id]);

  const submitLifecycle = useCallback(async () => {
    if (!lifecycleModal || !id || !lifecycle) return;
    const eligible =
      lifecycleModal === 'close'
        ? lifecycle.can_close && canClosePerm
        : lifecycle.can_archive && canArchivePerm;
    if (!eligible) return;

    const trimmed = lifecycleReason.trim();
    const reasonPayload = trimmed.length > 0 ? { reason: trimmed.slice(0, 500) } : {};

    setActionLoading(true);
    setActionError(null);
    setActionErrorBlockers([]);
    try {
      const path =
        lifecycleModal === 'close' ? `/payrolls/${id}/close` : `/payrolls/${id}/archive`;
      await api.post(path, reasonPayload);
      setLifecycleModal(null);
      setLifecycleReason('');
      await load();
    } catch (e: unknown) {
      const { message, blockers } = parseLifecycleActionError(e);
      setActionError(message);
      setActionErrorBlockers(blockers);
    } finally {
      setActionLoading(false);
    }
  }, [canArchivePerm, canClosePerm, id, lifecycle, lifecycleModal, lifecycleReason, load]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageState = classifyPageState({ loading, error: loadError, data: detail ? [detail] : [] });
  usePageStateTelemetry('payroll.payrolls.detail', 'payroll', pageState);

  const closeButtonEligible =
    !!lifecycle && !lifecycleLoadError && lifecycle.can_close && canClosePerm;
  const archiveButtonEligible =
    !!lifecycle && !lifecycleLoadError && lifecycle.can_archive && canArchivePerm;

  const openLifecycleModal = (mode: 'close' | 'archive') => {
    setLifecycleModal(mode);
    setLifecycleReason('');
    setActionError(null);
    setActionErrorBlockers([]);
  };

  const closeLifecycleModal = () => {
    setLifecycleModal(null);
    setLifecycleReason('');
    setActionError(null);
    setActionErrorBlockers([]);
  };

  const modalSubmitEligible =
    lifecycleModal === 'close'
      ? !!lifecycle && lifecycle.can_close && canClosePerm
      : lifecycleModal === 'archive'
        ? !!lifecycle && lifecycle.can_archive && canArchivePerm
        : false;

  if (!canView) {
    return (
      <Page title="Payroll shell" subtitle="">
        <Banner variant="warning">
          You need <code style={{ padding: '0 6px' }}>pay_group:read</code> to view this page.
        </Banner>
      </Page>
    );
  }

  return (
    <Page
      title={detail?.label ?? 'Payroll shell'}
      subtitle={
        detail ? (
          <>
            {detail.legal_entity.name} · {detail.pay_group.code} ({detail.pay_group.country},{' '}
            {detail.pay_group.frequency})
          </>
        ) : (
          'Tax-year container'
        )
      }
      actions={
        <Link to="/payroll/payrolls" style={{ fontSize: 14, fontWeight: 600, color: '#4f46e5', textDecoration: 'none' }}>
          ← Payrolls
        </Link>
      }
    >
      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
        </div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          page="payroll.payrolls.detail"
          module="payroll"
          emptyTitle="Shell not found"
          emptyMessage="Check the URL or your legal entity access."
        />
      ) : detail ? (
        <>
          <Card>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                gap: 16,
                marginBottom: 24,
                fontSize: 13,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>Legal entity</div>
                <div>
                  <span style={{ color: styles.colors.textMuted }}>{detail.legal_entity.code}</span> {detail.legal_entity.name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>Pay group</div>
                <div>
                  {detail.pay_group.code} — {detail.pay_group.name}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>Country</div>
                <div>{detail.pay_group.country}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>Frequency</div>
                <div>{detail.pay_group.frequency}</div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>Tax year window</div>
                <div style={{ whiteSpace: 'nowrap' }}>
                  {detail.tax_year_start} → {detail.tax_year_end}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>Status</div>
                <StatusBadge status={detail.status} />
              </div>
            </div>

            {lifecycleLoadError != null ? (
              <Banner variant="warning">
                Could not load lifecycle eligibility preview (
                <code style={{ padding: '0 4px' }}>GET /v1/payrolls/:id/lifecycle-eligibility</code>). Close and archive
                actions stay disabled until this succeeds.
              </Banner>
            ) : null}

            {lifecycle && (
              <>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Lifecycle &amp; governance</div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 12,
                    marginBottom: 16,
                    fontSize: 13,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>
                      Linked periods
                    </div>
                    <div>{lifecycle.counts.linked_periods}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>
                      Governance-closed periods
                    </div>
                    <div>{lifecycle.counts.periods_closed}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>
                      In-flight payruns
                    </div>
                    <div>{lifecycle.counts.active_payruns}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: styles.colors.textMuted, marginBottom: 4 }}>
                      Paid / posted / finalized
                    </div>
                    <div>{lifecycle.counts.activity_payruns}</div>
                  </div>
                </div>

                {lifecycle.close_blockers.length > 0 && (
                  <Banner variant="warning">
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Close blockers</div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                      {lifecycle.close_blockers.map((b) => (
                        <li key={b.code} style={{ marginBottom: 4 }}>
                          <code style={{ fontSize: 11, padding: '0 4px' }}>{b.code}</code> — {b.message}
                        </li>
                      ))}
                    </ul>
                  </Banner>
                )}

                {lifecycle.archive_blockers.length > 0 && (
                  <Banner variant="warning">
                    <div style={{ fontWeight: 700, marginBottom: 8 }}>Archive blockers</div>
                    <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                      {lifecycle.archive_blockers.map((b) => (
                        <li key={b.code} style={{ marginBottom: 4 }}>
                          <code style={{ fontSize: 11, padding: '0 4px' }}>{b.code}</code> — {b.message}
                        </li>
                      ))}
                    </ul>
                  </Banner>
                )}

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <button
                    type="button"
                    style={styles.buttonSecondary}
                    disabled={!closeButtonEligible}
                    title={
                      !lifecycleLoadError && lifecycle && !lifecycle.can_close
                        ? 'Not eligible to close (see blockers above)'
                        : !canClosePerm
                          ? 'Requires permission payroll:containers:close'
                          : lifecycleLoadError
                            ? 'Fix lifecycle preview load error first'
                            : undefined
                    }
                    onClick={() => openLifecycleModal('close')}
                  >
                    Close shell
                  </button>
                  <button
                    type="button"
                    style={styles.buttonSecondary}
                    disabled={!archiveButtonEligible}
                    title={
                      !lifecycleLoadError && lifecycle && !lifecycle.can_archive
                        ? 'Not eligible to archive (see blockers above)'
                        : !canArchivePerm
                          ? 'Requires permission payroll:containers:archive'
                          : lifecycleLoadError
                            ? 'Fix lifecycle preview load error first'
                            : undefined
                    }
                    onClick={() => openLifecycleModal('archive')}
                  >
                    Archive shell
                  </button>
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: styles.colors.textMuted, lineHeight: 1.5 }}>
                  Actions use <code style={{ padding: '0 4px' }}>GET …/lifecycle-eligibility</code> first; POST runs only when
                  preview shows eligible and you confirm. Close requires{' '}
                  <code style={{ padding: '0 4px' }}>payroll:containers:close</code>; archive requires{' '}
                  <code style={{ padding: '0 4px' }}>payroll:containers:archive</code>. There is no delete.
                </p>
              </>
            )}

            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Linked pay periods</div>
          {detail.periods_total > detail.periods.length && (
            <Banner variant="info">
              Showing {detail.periods.length} of {detail.periods_total} periods (most recent first, max 500).
            </Banner>
          )}

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Year</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Period</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Start</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>End</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Pay date</th>
                  <th style={{ padding: '10px 8px', fontWeight: 700 }}>Closed</th>
                </tr>
              </thead>
              <tbody>
                {detail.periods.map((p) => (
                  <tr key={p.id} style={{ borderBottom: `1px solid ${styles.colors.border}` }}>
                    <td style={{ padding: '10px 8px' }}>{p.year}</td>
                    <td style={{ padding: '10px 8px' }}>{p.period_num}</td>
                    <td style={{ padding: '10px 8px' }}>{p.start_date}</td>
                    <td style={{ padding: '10px 8px' }}>{p.end_date}</td>
                    <td style={{ padding: '10px 8px' }}>{p.pay_date}</td>
                    <td style={{ padding: '10px 8px', color: p.closed_at ? '#15803d' : styles.colors.textMuted }}>
                      {p.closed_at ? 'Yes' : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {detail.periods.length === 0 && (
              <p style={{ marginTop: 12, fontSize: 13, color: styles.colors.textMuted }}>
                No periods linked to this shell yet.
              </p>
            )}
          </div>
          </Card>

          {lifecycleModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
              }}
            >
              <div
                style={{
                  background: '#fff',
                  borderRadius: 12,
                  padding: 24,
                  width: 480,
                  maxWidth: '92vw',
                  boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
                }}
              >
                <h3 style={{ margin: '0 0 12px' }}>
                  {lifecycleModal === 'close' ? 'Close tax-year shell' : 'Archive tax-year shell'}
                </h3>
                <p style={{ fontSize: 13, color: styles.colors.textMuted, margin: '0 0 16px' }}>
                  {lifecycleModal === 'close'
                    ? 'Sets the shell to CLOSED. Allowed only from PLANNING or ACTIVE when no in-flight payruns block closure.'
                    : 'Sets the shell to ARCHIVED only when governance gates pass (no archive blockers).'}
                  {' '}Optional reason is stored on the audit trail (max 500 characters).
                </p>
                {actionError && (
                  <Banner variant="warning">
                    <div style={{ marginBottom: actionErrorBlockers.length ? 8 : 0 }}>{actionError}</div>
                    {actionErrorBlockers.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
                        {actionErrorBlockers.map((b) => (
                          <li key={b.code}>
                            <code style={{ fontSize: 11, padding: '0 4px' }}>{b.code}</code> — {b.message}
                          </li>
                        ))}
                      </ul>
                    )}
                  </Banner>
                )}
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Reason (optional)</label>
                <textarea
                  value={lifecycleReason}
                  onChange={(e) => setLifecycleReason(e.target.value)}
                  placeholder="Audit note (optional)…"
                  rows={4}
                  maxLength={500}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: `1px solid ${styles.colors.border}`,
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
                <div style={{ fontSize: 11, color: styles.colors.textMuted, marginTop: 4 }}>
                  {lifecycleReason.length}/500
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" style={styles.buttonSecondary} onClick={closeLifecycleModal} disabled={actionLoading}>
                    Cancel
                  </button>
                  <button
                    type="button"
                    style={styles.buttonPrimary}
                    disabled={!modalSubmitEligible || actionLoading}
                    title={
                      !modalSubmitEligible
                        ? 'Not eligible — refresh the page if the shell changed'
                        : undefined
                    }
                    onClick={() => void submitLifecycle()}
                  >
                    {actionLoading
                      ? 'Working…'
                      : lifecycleModal === 'close'
                        ? 'Confirm close'
                        : 'Confirm archive'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      ) : null}
    </Page>
  );
}
