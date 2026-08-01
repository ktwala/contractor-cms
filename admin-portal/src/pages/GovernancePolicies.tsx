import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Banner, Stack } from '../ui/layout';

/** Mirrors `governance-policy-keys.ts` (GOV-6B) — keep aligned with backend. */
const POLICY_KEYS = [
  'financial_control.net_variance_threshold',
  'bank_reconciliation.fee_tolerance',
  'gl_reconciliation.rounding_tolerance',
  'override.justification_min_length',
  'closed_period.mutation_policy',
] as const;

const IMPACT_BY_KEY: Record<string, string> = {
  'financial_control.net_variance_threshold':
    'Changes the absolute tolerance between the net register and the financial export (GOV-3A). A looser value can hide material mismatches.',
  'bank_reconciliation.fee_tolerance':
    'Changes how much bank total vs export variance is tolerated before GOV-3B flags an exception.',
  'gl_reconciliation.rounding_tolerance':
    'Changes the epsilon used when comparing register totals to GL (GOV-3C).',
  'override.justification_min_length':
    'Changes the minimum justification length required for audited gate overrides and closed-period governed paths.',
  'closed_period.mutation_policy':
    'Changes closed-period mutation posture (e.g. GOVERNED_PATHS_ONLY disables break-glass bypass).',
};

type GovernanceScope = 'GLOBAL' | 'LEGAL_ENTITY' | 'PAY_GROUP';

type PolicyRow = {
  id: string;
  policy_key: string;
  scope: GovernanceScope;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  current_value: unknown;
  effective_from: string;
  changed_by_user_id: string;
  approval_reference: string | null;
  superseded_by_policy_id: string | null;
  created_at: string;
  updated_at: string;
};

type DraftRow = {
  id: string;
  policy_key: string;
  scope: GovernanceScope;
  legal_entity_id: string | null;
  pay_group_id: string | null;
  proposed_value: unknown;
  effective_from: string;
  impact_preview_hash: string;
  requested_by_user_id: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  status: string;
  activation_policy_id: string | null;
  approval_reference: string;
  created_at: string;
  updated_at: string;
};

type PayGroup = { id: string; code: string; name: string; legal_entity_id?: string };
type LegalEntity = { id: string; code: string; name: string };

type ImpactPreviewResponse = {
  policy_key: string;
  scope: string;
  previous_value: unknown | null;
  proposed_value: unknown;
  diff: {
    type: string;
    direction: string;
    delta: number | null;
    previous_mode?: string | null;
    proposed_mode?: string | null;
  };
  simulation: {
    quality: string;
    affected_payruns_checked: number;
    would_unblock_count: number;
    would_block_count: number;
    disclaimer: string;
  };
  payload_hash: string;
};

function defaultJsonForKey(key: string): string {
  switch (key) {
    case 'financial_control.net_variance_threshold':
    case 'bank_reconciliation.fee_tolerance':
    case 'gl_reconciliation.rounding_tolerance':
      return '0.01';
    case 'override.justification_min_length':
      return '20';
    case 'closed_period.mutation_policy':
      return '{"mode":"STANDARD"}';
    default:
      return '{}';
  }
}

function formatJson(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function draftStatusBadge(status: string) {
  const base: CSSProperties = {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 6,
    letterSpacing: 0.02,
  };
  if (status === 'REJECTED') {
    return <span style={{ ...base, background: '#fee2e2', color: '#991b1b' }}>Rejected</span>;
  }
  if (status === 'CANCELLED') {
    return <span style={{ ...base, background: '#f1f5f9', color: '#475569' }}>Cancelled</span>;
  }
  if (status === 'PENDING_APPROVAL') {
    return <span style={{ ...base, background: '#fef9c3', color: '#854d0e' }}>Pending approval</span>;
  }
  if (status === 'APPROVED') {
    return <span style={{ ...base, background: '#dcfce7', color: '#166534' }}>Approved</span>;
  }
  if (status === 'ACTIVATED') {
    return <span style={{ ...base, background: '#dbeafe', color: '#1e40af' }}>Activated</span>;
  }
  return <span style={{ ...base, background: styles.colors.borderLight, color: styles.colors.textSecondary }}>{status}</span>;
}

export default function GovernancePolicies() {
  const { can } = useAccess();
  const [payGroups, setPayGroups] = useState<PayGroup[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntity[]>([]);
  const [scope, setScope] = useState<GovernanceScope>('LEGAL_ENTITY');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [payGroupId, setPayGroupId] = useState('');
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [history, setHistory] = useState<PolicyRow[]>([]);
  const [historyLabel, setHistoryLabel] = useState<string | null>(null);
  const [policyKey, setPolicyKey] = useState<string>(POLICY_KEYS[0]);
  const [valueJson, setValueJson] = useState(defaultJsonForKey(POLICY_KEYS[0]));
  const [effectiveFrom, setEffectiveFrom] = useState(() => new Date().toISOString().slice(0, 16));
  const [approvalReference, setApprovalReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [impactAck, setImpactAck] = useState(false);
  const [impactPreview, setImpactPreview] = useState<ImpactPreviewResponse | null>(null);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [draftActionLoading, setDraftActionLoading] = useState<string | null>(null);
  const [draftsPanelLoaded, setDraftsPanelLoaded] = useState(false);

  const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('user_id') : null;

  useEffect(() => {
    setDraftsPanelLoaded(false);
  }, [scope, legalEntityId, payGroupId]);

  useEffect(() => {
    void (async () => {
      try {
        const [pgRes, leRes] = await Promise.all([
          api.get('/pay-groups?limit=200'),
          api.get('/legal-entities', { params: { limit: 200 } }),
        ]);
        setPayGroups(pgRes.data?.items ?? pgRes.data ?? []);
        setLegalEntities(leRes.data?.items ?? leRes.data ?? []);
      } catch {
        setPayGroups([]);
        setLegalEntities([]);
      }
    })();
  }, []);

  const listParams = useMemo(() => {
    const p: Record<string, string> = {};
    if (scope === 'LEGAL_ENTITY' && legalEntityId) p.legal_entity_id = legalEntityId;
    if (scope === 'PAY_GROUP' && payGroupId) p.pay_group_id = payGroupId;
    return p;
  }, [scope, legalEntityId, payGroupId]);

  const canLoadList = useMemo(() => {
    if (scope === 'GLOBAL') return true;
    if (scope === 'LEGAL_ENTITY') return !!legalEntityId;
    return !!payGroupId;
  }, [scope, legalEntityId, payGroupId]);

  useEffect(() => {
    setImpactPreview(null);
    setImpactAck(false);
    setConfirmOpen(false);
  }, [policyKey, valueJson, scope, legalEntityId, payGroupId, effectiveFrom]);

  const buildVersionPayload = useCallback(() => {
    const parsed = JSON.parse(valueJson) as unknown;
    const body: Record<string, unknown> = {
      policy_key: policyKey,
      scope,
      current_value: parsed,
      effective_from: new Date(effectiveFrom).toISOString(),
    };
    if (scope === 'LEGAL_ENTITY') body.legal_entity_id = legalEntityId;
    if (scope === 'PAY_GROUP') {
      body.pay_group_id = payGroupId;
      const pg = payGroups.find((g) => g.id === payGroupId);
      if (pg?.legal_entity_id) body.legal_entity_id = pg.legal_entity_id;
    }
    return body;
  }, [policyKey, valueJson, scope, legalEntityId, payGroupId, effectiveFrom, payGroups]);

  const loadDrafts = useCallback(async () => {
    if (!canLoadList) return;
    try {
      const res = await api.get('/api/payroll-cycle/governance-policies/drafts', { params: listParams });
      setDrafts((res.data ?? []) as DraftRow[]);
    } catch {
      setDrafts([]);
    }
  }, [canLoadList, listParams]);

  const loadPolicies = useCallback(async () => {
    if (!canLoadList) {
      setError('Choose scope dimensions before loading policies.');
      return;
    }
    setLoading(true);
    setError(null);
    setPolicies([]);
    setHistory([]);
    setHistoryLabel(null);
    try {
      const [polRes] = await Promise.all([
        api.get('/api/payroll-cycle/governance-policies', { params: listParams }),
        loadDrafts(),
      ]);
      setPolicies((polRes.data ?? []) as PolicyRow[]);
      setDraftsPanelLoaded(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, [canLoadList, listParams, loadDrafts]);

  const loadHistory = async (row: PolicyRow) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {
        policy_key: row.policy_key,
        scope: row.scope,
      };
      if (row.legal_entity_id) params.legal_entity_id = row.legal_entity_id;
      if (row.pay_group_id) params.pay_group_id = row.pay_group_id;
      const res = await api.get('/api/payroll-cycle/governance-policies/history', { params });
      setHistory((res.data ?? []) as PolicyRow[]);
      setHistoryLabel(`${row.policy_key} · ${row.scope}`);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to load history');
      setHistory([]);
      setHistoryLabel(null);
    } finally {
      setLoading(false);
    }
  };

  const runImpactPreviewAndOpenModal = async () => {
    setError(null);
    if (!canLoadList) {
      setError('Choose scope dimensions before running impact preview.');
      return;
    }
    try {
      JSON.parse(valueJson);
    } catch {
      setError('Current value must be valid JSON.');
      return;
    }
    setLoading(true);
    setImpactPreview(null);
    try {
      const res = await api.post('/api/payroll-cycle/governance-policies/impact-preview', buildVersionPayload());
      setImpactPreview(res.data as ImpactPreviewResponse);
      setImpactAck(false);
      setConfirmOpen(true);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Impact preview failed');
    } finally {
      setLoading(false);
    }
  };

  const submitDraft = async () => {
    if (!impactAck || !impactPreview) return;
    if (!approvalReference.trim()) {
      setError('Approval reference is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        ...buildVersionPayload(),
        approval_reference: approvalReference.trim(),
        impact_preview_hash: impactPreview.payload_hash,
      };
      await api.post('/api/payroll-cycle/governance-policies/drafts', body);
      setConfirmOpen(false);
      setImpactPreview(null);
      setApprovalReference('');
      await loadPolicies();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Failed to submit governance policy draft');
    } finally {
      setSaving(false);
    }
  };

  const approveDraft = async (draftId: string) => {
    setDraftActionLoading(draftId);
    setError(null);
    try {
      await api.post(`/api/payroll-cycle/governance-policies/drafts/${draftId}/approve`);
      await loadDrafts();
      await loadPolicies();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Approve failed');
    } finally {
      setDraftActionLoading(null);
    }
  };

  const activateDraft = async (draftId: string) => {
    setDraftActionLoading(draftId);
    setError(null);
    try {
      await api.post(`/api/payroll-cycle/governance-policies/drafts/${draftId}/activate`);
      await loadDrafts();
      await loadPolicies();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Activate failed');
    } finally {
      setDraftActionLoading(null);
    }
  };

  const rejectDraft = async (draftId: string) => {
    setDraftActionLoading(draftId);
    setError(null);
    try {
      await api.post(`/api/payroll-cycle/governance-policies/drafts/${draftId}/reject`);
      await loadDrafts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Reject failed');
    } finally {
      setDraftActionLoading(null);
    }
  };

  const cancelDraft = async (draftId: string) => {
    setDraftActionLoading(draftId);
    setError(null);
    try {
      await api.post(`/api/payroll-cycle/governance-policies/drafts/${draftId}/cancel`);
      await loadDrafts();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      setError(err?.response?.data?.message ?? 'Cancel failed');
    } finally {
      setDraftActionLoading(null);
    }
  };

  const onPolicyKeyChange = (k: string) => {
    setPolicyKey(k);
    setValueJson(defaultJsonForKey(k));
  };

  if (!can('payrun:admin')) {
    return (
      <Page title="Governance policies">
        <Banner variant="error">You need payrun:admin to administer governance policy versions (GOV-6C).</Banner>
      </Page>
    );
  }

  return (
    <Page
      title="Governance policies"
      subtitle="GOV-6C / GOV-7A / GOV-7B / GOV-7B-2 — /payroll/governance-policies · draft → reject|cancel → approve → activate"
      breadcrumbs={
        <Stack direction="row" gap={8} style={{ fontSize: 13 }}>
          <Link to="/payroll/payruns" style={{ color: styles.colors.primary }}>Payruns</Link>
          <span style={{ color: styles.colors.textMuted }}>/</span>
          <Link to="/payroll/governance-portfolio" style={{ color: styles.colors.primary }}>Portfolio</Link>
          <span style={{ color: styles.colors.textMuted }}>/</span>
          <span style={{ color: styles.colors.textMuted }}>Policies</span>
        </Stack>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}
      {loading && !saving && <Banner variant="info">Loading…</Banner>}

      <Card>
        <CardHeader title="Scope" />
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 360 }}>
            <span style={{ fontWeight: 600 }}>Policy scope</span>
            <select
              value={scope}
              onChange={(e) => {
                setScope(e.target.value as GovernanceScope);
                setHistory([]);
                setHistoryLabel(null);
              }}
              style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}
            >
              <option value="GLOBAL">Global</option>
              <option value="LEGAL_ENTITY">Legal entity</option>
              <option value="PAY_GROUP">Pay group</option>
            </select>
          </label>
          {scope === 'LEGAL_ENTITY' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
              <span style={{ fontWeight: 600 }}>Legal entity</span>
              <select
                value={legalEntityId}
                onChange={(e) => setLegalEntityId(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}
              >
                <option value="">Select…</option>
                {legalEntities.map((le) => (
                  <option key={le.id} value={le.id}>{le.code} — {le.name}</option>
                ))}
              </select>
            </label>
          )}
          {scope === 'PAY_GROUP' && (
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 420 }}>
              <span style={{ fontWeight: 600 }}>Pay group</span>
              <select
                value={payGroupId}
                onChange={(e) => setPayGroupId(e.target.value)}
                style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}
              >
                <option value="">Select…</option>
                {payGroups.map((g) => (
                  <option key={g.id} value={g.id}>{g.code} — {g.name}</option>
                ))}
              </select>
            </label>
          )}
          <div>
            <button type="button" style={styles.buttonPrimary} disabled={!canLoadList || loading} onClick={() => void loadPolicies()}>
              Load current policies
            </button>
            <span style={{ marginLeft: 12, fontSize: 12, color: styles.colors.textMuted }}>
              Global lists all policy heads (operators with global portfolio scope only).
            </span>
          </div>
        </div>
      </Card>

      {draftsPanelLoaded && (
        <Card>
          <CardHeader title="Policy drafts (GOV-7B / GOV-7B-2)" />
          <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
            <p style={{ margin: '0 0 12px', fontSize: 12, color: styles.colors.textSecondary }}>
              Approver must differ from the requester. Requester may <strong>cancel</strong> a pending draft; another operator may <strong>reject</strong> or <strong>approve</strong>. Rejected / cancelled drafts stay listed for audit and cannot be activated.
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <th style={{ padding: '8px 6px' }}>Draft id</th>
                  <th style={{ padding: '8px 6px' }}>Key</th>
                  <th style={{ padding: '8px 6px' }}>Status</th>
                  <th style={{ padding: '8px 6px' }}>Requested by</th>
                  <th style={{ padding: '8px 6px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {drafts.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '12px 6px', color: styles.colors.textMuted, fontSize: 13 }}>
                      No drafts in this scope.
                    </td>
                  </tr>
                ) : (
                  drafts.map((d) => {
                    const sameUser = !!currentUserId && d.requested_by_user_id === currentUserId;
                    const busy = draftActionLoading === d.id;
                    const pending = d.status === 'PENDING_APPROVAL';
                    return (
                      <tr key={d.id} style={{ borderBottom: `1px solid ${styles.colors.borderLight}` }}>
                        <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 11 }}>{d.id.slice(0, 8)}…</td>
                        <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{d.policy_key}</td>
                        <td style={{ padding: '8px 6px' }}>{draftStatusBadge(d.status)}</td>
                        <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 11 }}>{d.requested_by_user_id}</td>
                        <td style={{ padding: '8px 6px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            style={styles.buttonSecondary}
                            disabled={busy || !pending || sameUser}
                            title={sameUser ? 'Use a different operator account to approve (SoD).' : undefined}
                            onClick={() => void approveDraft(d.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            style={styles.buttonSecondary}
                            disabled={busy || !pending || sameUser}
                            title={sameUser ? 'Another operator must reject (you can cancel instead).' : undefined}
                            onClick={() => void rejectDraft(d.id)}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            style={styles.buttonSecondary}
                            disabled={busy || !pending || !sameUser}
                            title={!sameUser ? 'Only the requester may cancel this draft.' : undefined}
                            onClick={() => void cancelDraft(d.id)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            style={styles.buttonPrimary}
                            disabled={busy || d.status !== 'APPROVED'}
                            onClick={() => void activateDraft(d.id)}
                          >
                            Activate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {policies.length > 0 && (
        <Card>
          <CardHeader title="Current policies (heads)" />
          <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <th style={{ padding: '8px 6px' }}>Key</th>
                  <th style={{ padding: '8px 6px' }}>Scope</th>
                  <th style={{ padding: '8px 6px' }}>Value</th>
                  <th style={{ padding: '8px 6px' }}>Effective</th>
                  <th style={{ padding: '8px 6px' }}>Changed by</th>
                  <th style={{ padding: '8px 6px' }}>Approval</th>
                  <th style={{ padding: '8px 6px' }} />
                </tr>
              </thead>
              <tbody>
                {policies.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${styles.colors.borderLight}` }}>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace' }}>{row.policy_key}</td>
                    <td style={{ padding: '8px 6px' }}>{row.scope}</td>
                    <td style={{ padding: '8px 6px', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <code>{formatJson(row.current_value).slice(0, 80)}{formatJson(row.current_value).length > 80 ? '…' : ''}</code>
                    </td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{new Date(row.effective_from).toLocaleString()}</td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 12 }}>{row.changed_by_user_id}</td>
                    <td style={{ padding: '8px 6px' }}>{row.approval_reference ?? '—'}</td>
                    <td style={{ padding: '8px 6px' }}>
                      <button type="button" style={styles.buttonSecondary} disabled={loading} onClick={() => void loadHistory(row)}>
                        History
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {history.length > 0 && historyLabel && (
        <Card>
          <CardHeader title={`Supersession history — ${historyLabel}`} />
          <div style={{ padding: '0 16px 16px', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${styles.colors.border}` }}>
                  <th style={{ padding: '8px 6px' }}>Version id</th>
                  <th style={{ padding: '8px 6px' }}>Effective</th>
                  <th style={{ padding: '8px 6px' }}>Changed by</th>
                  <th style={{ padding: '8px 6px' }}>Approval</th>
                  <th style={{ padding: '8px 6px' }}>Superseded by</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id} style={{ borderBottom: `1px solid ${styles.colors.borderLight}` }}>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 12 }}>{row.id}</td>
                    <td style={{ padding: '8px 6px', whiteSpace: 'nowrap' }}>{new Date(row.effective_from).toLocaleString()}</td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 12 }}>{row.changed_by_user_id}</td>
                    <td style={{ padding: '8px 6px' }}>{row.approval_reference ?? '—'}</td>
                    <td style={{ padding: '8px 6px', fontFamily: 'monospace', fontSize: 12 }}>{row.superseded_by_policy_id ?? '— (current head)'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader title="Propose policy change (draft)" />
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13 }}>
          <p style={{ margin: 0, color: styles.colors.textSecondary }}>
            Uses the scope selected above. Run <strong>impact preview</strong> (GOV-7A) for a server hash, acknowledge, then <strong>submit a draft</strong> (GOV-7B).
            A separate <code>payrun:admin</code> operator must <strong>approve</strong>, then someone may <strong>activate</strong> to create the active version and <strong>GOV_POLICY_VERSION_CREATE</strong> audit.
          </p>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 }}>
            <span style={{ fontWeight: 600 }}>Policy key</span>
            <select
              value={policyKey}
              onChange={(e) => onPolicyKeyChange(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}
            >
              {POLICY_KEYS.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontWeight: 600 }}>Current value (JSON)</span>
            <textarea
              value={valueJson}
              onChange={(e) => setValueJson(e.target.value)}
              rows={8}
              style={{
                fontFamily: 'monospace',
                fontSize: 12,
                padding: 10,
                borderRadius: 8,
                border: `1px solid ${styles.colors.border}`,
              }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 320 }}>
            <span style={{ fontWeight: 600 }}>Effective from (local)</span>
            <input
              type="datetime-local"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 480 }}>
            <span style={{ fontWeight: 600 }}>Approval reference (required)</span>
            <input
              type="text"
              value={approvalReference}
              onChange={(e) => setApprovalReference(e.target.value)}
              placeholder="e.g. Linear APP-123 or board minute ref"
              style={{ padding: 8, borderRadius: 6, border: `1px solid ${styles.colors.border}` }}
            />
          </label>
          <div>
            <button
              type="button"
              style={styles.buttonPrimary}
              disabled={!canLoadList || loading || saving}
              onClick={() => void runImpactPreviewAndOpenModal()}
            >
              Run impact preview
            </button>
          </div>
        </div>
      </Card>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15,23,42,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 80,
            padding: 16,
          }}
        >
          <div style={{ ...styles.cardBase, maxWidth: 560, width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <div style={{ ...styles.cardHeaderStyle, marginBottom: 8 }}>Impact preview & acknowledgement</div>
            <p style={{ fontSize: 14, color: styles.colors.text, marginTop: 0 }}>
              {IMPACT_BY_KEY[policyKey] ?? 'This policy key affects live payrun governance behaviour.'}
            </p>
            {impactPreview && (
              <div style={{ marginBottom: 14, fontSize: 12, color: styles.colors.textSecondary }}>
                <div style={{ fontWeight: 600, marginBottom: 6, color: styles.colors.text }}>Diff</div>
                <pre style={{ margin: '0 0 8px', padding: 10, background: styles.colors.borderLight, borderRadius: 8, overflow: 'auto' }}>
                  {JSON.stringify(impactPreview.diff, null, 2)}
                </pre>
                <div style={{ fontWeight: 600, marginBottom: 6, color: styles.colors.text }}>Heuristic simulation</div>
                <pre style={{ margin: '0 0 8px', padding: 10, background: styles.colors.borderLight, borderRadius: 8, overflow: 'auto' }}>
                  {JSON.stringify(
                    {
                      quality: impactPreview.simulation.quality,
                      affected_payruns_checked: impactPreview.simulation.affected_payruns_checked,
                      would_unblock_count: impactPreview.simulation.would_unblock_count,
                      would_block_count: impactPreview.simulation.would_block_count,
                      disclaimer: impactPreview.simulation.disclaimer,
                    },
                    null,
                    2,
                  )}
                </pre>
                <div style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  <span style={{ fontWeight: 600 }}>Payload hash</span> (must match POST): {impactPreview.payload_hash}
                </div>
              </div>
            )}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 13, marginBottom: 16 }}>
              <input type="checkbox" checked={impactAck} onChange={(e) => setImpactAck(e.target.checked)} />
              <span>I have reviewed the impact preview and understand this change can affect payrun gates for the selected scope.</span>
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                type="button"
                style={styles.buttonSecondary}
                onClick={() => {
                  setConfirmOpen(false);
                  setImpactPreview(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>
              <button type="button" style={styles.buttonPrimary} disabled={!impactAck || saving} onClick={() => void submitDraft()}>
                {saving ? 'Submitting…' : 'Submit draft for approval'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}
