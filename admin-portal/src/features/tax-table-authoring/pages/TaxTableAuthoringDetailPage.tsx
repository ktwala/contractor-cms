import React, { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  RotateCcw,
  RefreshCw,
  Play,
  ArrowLeftRight,
  Send,
  Shield,
  Upload,
  Archive,
  Check,
  CheckCircle,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  Clock,
} from 'lucide-react';
import * as styles from '../../../styles/common';
import { Page, Card } from '../../../ui/layout';
import {
  fetchVersion,
  updateBrackets,
  updateFields,
  validateVersion,
  simulateVersion,
  diffAgainstRuntime,
  submitForApproval,
  approveVersion,
  publishVersion,
  archiveVersion,
  fetchAuditTrail,
  fetchPublishedRuntime,
} from '../api';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import { ErrorBanner } from '../components/ErrorBanner';
import { TableSkeleton, CardSkeleton } from '../components/LoadingSkeleton';
import { useTtaPermissions } from '../hooks/useTtaPermissions';
import { ImpactAnalysisPanel } from '../components/impact/ImpactAnalysisPanel';
import type {
  AuthoringVersion,
  AuthoringBracket,
  AuthoringField,
  ValidationIssue,
  SimulationResult,
  DiffResult,
  AuditEvent,
} from '../types';

const DETAIL_TABS = [
  { key: 'summary', label: 'Summary' },
  { key: 'brackets', label: 'Brackets' },
  { key: 'validation', label: 'Validation' },
  { key: 'simulation', label: 'Simulation' },
  { key: 'compare', label: 'Compare' },
  { key: 'impact', label: 'Impact Analysis' },
  { key: 'lifecycle', label: 'Lifecycle' },
  { key: 'audit', label: 'Audit' },
];

const DEFAULT_INCOMES = [60000, 120000, 250000, 500000, 1000000, 2000000];

export default function TaxTableAuthoringDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') ?? 'summary';
  const perms = useTtaPermissions();

  const [version, setVersion] = useState<AuthoringVersion | null>(null);
  const [brackets, setBrackets] = useState<AuthoringBracket[]>([]);
  const [fields, setFields] = useState<AuthoringField[]>([]);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [runtimeLink, setRuntimeLink] = useState<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acting, setActing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [error, setError] = useState<{ code?: string; message?: string } | string | null>(null);
  const [customIncomes, setCustomIncomes] = useState('');
  const [simAge, setSimAge] = useState(35);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [publishReason, setPublishReason] = useState('');

  const loadVersion = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const v = await fetchVersion(id);
      setVersion(v);
      setBrackets(v.brackets ?? []);
      setFields(v.fields ?? []);
      setDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to load');
    }
    setLoading(false);
  }, [id]);

  useEffect(() => { void loadVersion(); }, [loadVersion]);

  // ─── Bracket editing ───
  function updateBracket(index: number, field: keyof AuthoringBracket, value: any) {
    setBrackets((prev) => prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)));
    setDirty(true);
  }
  function addBracket() {
    const last = brackets[brackets.length - 1];
    setBrackets((prev) => [
      ...prev.map((b) => ({ ...b, isOpenEnded: false })),
      {
        id: `new-${Date.now()}`,
        seqNo: (last?.seqNo ?? 0) + 1,
        bracketFrom: last?.bracketTo ?? 0,
        bracketTo: null,
        marginalRate: 0,
        baseTax: 0,
        derivedBaseTax: null,
        isOpenEnded: true,
        baseTaxOverrideReason: null,
      },
    ]);
    setDirty(true);
  }
  function removeBracket(index: number) {
    setBrackets((prev) => prev.filter((_, i) => i !== index));
    setDirty(true);
  }
  function updateField(index: number, value: unknown) {
    setFields((prev) => prev.map((f, i) => (i === index ? { ...f, fieldValue: value } : f)));
    setDirty(true);
  }
  async function saveDraft() {
    if (!id) return;
    setSaving(true);
    setError(null);
    try {
      await updateBrackets(id, brackets.map((b, i) => ({
        seqNo: i + 1,
        bracketFrom: Number(b.bracketFrom),
        bracketTo: b.bracketTo != null ? Number(b.bracketTo) : null,
        marginalRate: Number(b.marginalRate),
        baseTax: Number(b.baseTax),
        isOpenEnded: !!b.isOpenEnded,
      })));
      if (fields.length > 0) {
        await updateFields(id, fields.map((f) => ({ fieldCode: f.fieldCode, fieldValue: f.fieldValue })));
      }
      await loadVersion();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to save');
    }
    setSaving(false);
  }

  // ─── Validation, Simulation, Diff ───
  async function runValidation() {
    if (!id) return;
    setError(null);
    try {
      const r = await validateVersion(id);
      setIssues(r.issues ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Validation failed');
    }
  }
  async function runSimulation() {
    if (!id) return;
    setError(null);
    try {
      const incomes = customIncomes.trim()
        ? customIncomes.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
        : DEFAULT_INCOMES;
      const r = await simulateVersion(id, { annualIncomes: incomes, age: simAge });
      setSimulation(r);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Simulation failed');
    }
  }
  async function runDiff() {
    if (!id) return;
    setError(null);
    try {
      const r = await diffAgainstRuntime(id);
      setDiff(r);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Diff failed');
    }
  }
  async function loadAudit() {
    if (!id) return;
    try {
      const trail = await fetchAuditTrail(id);
      setAudit(trail);
    } catch { /* ignore */ }
  }
  async function loadRuntimeLink() {
    if (!id || !version?.publishedTaxTableSetId) return;
    try {
      const rt = await fetchPublishedRuntime(id);
      setRuntimeLink(rt);
    } catch { /* ignore */ }
  }

  // ─── Lifecycle actions ───
  async function handleLifecycleAction(action: string) {
    if (!id) return;
    setActing(true);
    setError(null);
    try {
      switch (action) {
        case 'submit': await submitForApproval(id); break;
        case 'approve': await approveVersion(id); break;
        case 'publish':
          await publishVersion(id, publishReason || undefined);
          setConfirmPublish(false);
          break;
        case 'archive': await archiveVersion(id); break;
      }
      await loadVersion();
      if (action === 'publish' && id) {
        try {
          const rt = await fetchPublishedRuntime(id);
          setRuntimeLink(rt);
        } catch { /* runtime link may not be immediately available */ }
        void loadAudit();
      }
    } catch (e: any) {
      const errData = e?.response?.data?.error;
      setError(errData ? { code: errData.code, message: errData.message } : `${action} failed`);
    }
    setActing(false);
  }

  // ─── Tab switch side-effects ───
  useEffect(() => {
    if (activeTab === 'audit' && audit.length === 0 && id) void loadAudit();
    if (activeTab === 'lifecycle' && version?.status === 'PUBLISHED') void loadRuntimeLink();
  }, [activeTab, id, version?.status]);

  if (loading) {
    return (
      <Page title="Loading…">
        <TableSkeleton rows={6} />
      </Page>
    );
  }

  if (!version) {
    return (
      <Page title="Not Found" subtitle="This authoring version was not found">
        <button style={styles.buttonSecondary} onClick={() => navigate('/admin/payroll/tax-tables')}>
          <ArrowLeft size={14} /> Back to list
        </button>
      </Page>
    );
  }

  const isDraft = version.status === 'DRAFT';
  const submitCheck = perms.canPerformAction('submit_approval', version);
  const approveCheck = perms.canPerformAction('approve', version);
  const publishCheck = perms.canPerformAction('publish', version);
  const archiveCheck = perms.canPerformAction('archive', version);
  const validationErrors = issues?.filter((i) => i.severity === 'ERROR') ?? [];
  const validationWarnings = issues?.filter((i) => i.severity === 'WARNING') ?? [];

  return (
    <Page
      title={`${version.countryCode} ${version.tableType} — ${version.taxYear}`}
      subtitle={`Authoring Version • Effective from ${version.effectiveFrom?.slice(0, 10)}`}
      actions={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <StatusBadge status={version.status as any} />
          <SourceBadge source={version.sourceType as any} />
          <button
            style={styles.buttonSecondary}
            onClick={() => navigate('/admin/payroll/tax-tables')}
          >
            <ArrowLeft size={14} /> List
          </button>
        </div>
      }
    >
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

      {/* Tabs */}
      <div style={styles.tabBar}>
        {DETAIL_TABS.map((tab) => (
          <button
            key={tab.key}
            style={{ ...styles.tabButton, ...(activeTab === tab.key ? styles.tabActive : {}) }}
            onClick={() => { const p = new URLSearchParams(searchParams); p.set('tab', tab.key); setSearchParams(p); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary tab */}
      {activeTab === 'summary' && (
        <div>
          <div style={styles.grid2}>
            <Card>
              <div style={styles.cardHeader}><div style={styles.cardTitle}>Details</div></div>
              <InfoRow label="Country" value={version.countryCode} />
              <InfoRow label="Table Type" value={version.tableType} />
              <InfoRow label="Tax Year" value={version.taxYear} />
              <InfoRow label="Effective From" value={version.effectiveFrom?.slice(0, 10)} />
              <InfoRow label="Effective To" value={version.effectiveTo?.slice(0, 10) ?? '—'} />
              <InfoRow label="Source" value={version.sourceType} />
              {version.sourceReference && <InfoRow label="Ref" value={version.sourceReference} />}
              <InfoRow label="Created" value={new Date(version.createdAt).toLocaleString()} />
              <InfoRow label="Updated" value={new Date(version.updatedAt).toLocaleString()} />
            </Card>
            <Card>
              <div style={styles.cardHeader}><div style={styles.cardTitle}>Quick Stats</div></div>
              <StatRow label="Brackets" value={String(brackets.length)} />
              <StatRow label="Fields" value={String(fields.length)} />
              {version.publishedAt && <InfoRow label="Published" value={new Date(version.publishedAt).toLocaleString()} />}
              {version.publishedTaxTableSetId && (
                <InfoRow label="Runtime ID" value={version.publishedTaxTableSetId.slice(0, 12) + '…'} />
              )}
            </Card>
          </div>
          {version.sourceType === 'TEMPLATE' && version.templateCode && (
            <div style={{ marginTop: 16 }}>
              <Card>
                <div style={styles.cardHeader}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Shield size={16} style={{ color: '#16a34a' }} />
                    <div style={styles.cardTitle}>Template Origin</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <InfoRow label="Template" value={version.templateCode} />
                  {version.templateVersion && <InfoRow label="Version" value={`v${version.templateVersion}`} />}
                  {version.sourceReference && <InfoRow label="Source" value={version.sourceReference} />}
                  {version.templateId && <InfoRow label="Template ID" value={version.templateId} />}
                </div>
                <div style={{ marginTop: 8, fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                  This draft was created from an official Hubsec-managed template. Any edits made after creation are tracked in the audit trail.
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Brackets tab */}
      {activeTab === 'brackets' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#64748b', cursor: 'pointer' }}>
                <input type="checkbox" checked={advancedMode} onChange={(e) => setAdvancedMode(e.target.checked)} />
                Advanced (edit base tax)
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isDraft && (
                <>
                  <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={loadVersion}><RotateCcw size={13} /> Reset</button>
                  <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={addBracket}><Plus size={13} /> Add</button>
                </>
              )}
              {dirty && (
                <button style={{ ...styles.buttonPrimary, padding: '6px 16px', fontSize: 13, opacity: saving ? 0.5 : 1 }} onClick={saveDraft} disabled={saving}>
                  <Save size={13} /> {saving ? 'Saving…' : 'Save'}
                </button>
              )}
            </div>
          </div>
          <Card>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...styles.table, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Seq</th>
                    <th style={styles.th}>From</th>
                    <th style={styles.th}>To</th>
                    <th style={styles.th}>Rate (%)</th>
                    <th style={styles.th}>Base Tax</th>
                    <th style={styles.th}>Derived</th>
                    <th style={styles.th}>Open</th>
                    {isDraft && <th style={styles.th}></th>}
                  </tr>
                </thead>
                <tbody>
                  {brackets.map((b, i) => {
                    const mismatch = b.derivedBaseTax != null && Math.abs(Number(b.baseTax) - Number(b.derivedBaseTax)) > 0.01;
                    return (
                      <tr key={b.id} style={{ ...styles.tr, background: mismatch ? '#fffbeb' : undefined }}>
                        <td style={styles.td}>{i + 1}</td>
                        <td style={styles.td}>
                          {isDraft ? (
                            <input type="number" value={b.bracketFrom} onChange={(e) => updateBracket(i, 'bracketFrom', Number(e.target.value))} style={{ ...inputSm, width: 110 }} />
                          ) : (
                            Number(b.bracketFrom).toLocaleString()
                          )}
                        </td>
                        <td style={styles.td}>
                          {b.isOpenEnded ? '∞' : isDraft ? (
                            <input type="number" value={b.bracketTo ?? ''} onChange={(e) => updateBracket(i, 'bracketTo', e.target.value ? Number(e.target.value) : null)} style={{ ...inputSm, width: 110 }} />
                          ) : (
                            b.bracketTo != null ? Number(b.bracketTo).toLocaleString() : '—'
                          )}
                        </td>
                        <td style={styles.td}>
                          {isDraft ? (
                            <input type="number" step="0.001" value={b.marginalRate} onChange={(e) => updateBracket(i, 'marginalRate', Number(e.target.value))} style={{ ...inputSm, width: 90 }} />
                          ) : (
                            b.marginalRate
                          )}
                        </td>
                        <td style={styles.td}>
                          {advancedMode && isDraft ? (
                            <div>
                              <input type="number" value={b.baseTax} onChange={(e) => updateBracket(i, 'baseTax', Number(e.target.value))} style={{ ...inputSm, width: 110, borderColor: mismatch ? '#f59e0b' : undefined }} />
                              {mismatch && <input type="text" placeholder="Reason…" value={b.baseTaxOverrideReason ?? ''} onChange={(e) => updateBracket(i, 'baseTaxOverrideReason', e.target.value)} style={{ ...inputSm, width: 110, marginTop: 4, fontSize: 11 }} />}
                            </div>
                          ) : (
                            <span style={{ color: mismatch ? '#92400e' : undefined }}>
                              {Number(b.baseTax).toLocaleString()}
                              {mismatch && <AlertTriangle size={12} style={{ color: '#f59e0b', marginLeft: 4, verticalAlign: -2 }} />}
                            </span>
                          )}
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: 12, color: '#94a3b8' }}>
                            {b.derivedBaseTax != null ? Number(b.derivedBaseTax).toLocaleString() : '—'}
                          </span>
                        </td>
                        <td style={styles.td}>
                          {isDraft ? (
                            <input type="checkbox" checked={b.isOpenEnded} onChange={(e) => updateBracket(i, 'isOpenEnded', e.target.checked)} />
                          ) : (
                            b.isOpenEnded ? 'Yes' : 'No'
                          )}
                        </td>
                        {isDraft && (
                          <td style={styles.td}>
                            <button onClick={() => removeBracket(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {fields.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Supplemental Fields</h3>
              <Card>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  {fields.map((f, i) => (
                    <div key={f.id}>
                      <label style={styles.formLabel}>{f.fieldCode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</label>
                      {isDraft ? (
                        <input
                          type="text"
                          value={typeof f.fieldValue === 'object' ? JSON.stringify(f.fieldValue) : String(f.fieldValue ?? '')}
                          onChange={(e) => { try { updateField(i, JSON.parse(e.target.value)); } catch { updateField(i, e.target.value); } }}
                          style={styles.formInput}
                        />
                      ) : (
                        <div style={{ fontSize: 14, padding: '8px 0' }}>{typeof f.fieldValue === 'object' ? JSON.stringify(f.fieldValue) : String(f.fieldValue)}</div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Validation tab */}
      {activeTab === 'validation' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={runValidation}>
              <RefreshCw size={13} /> Run Validation
            </button>
          </div>
          {issues === null ? (
            <Card><div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Click "Run Validation" to check this draft</div></Card>
          ) : issues.length === 0 ? (
            <Card><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065f46' }}><CheckCircle size={18} /> All checks passed</div></Card>
          ) : (
            <Card>
              {validationErrors.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#991b1b', marginBottom: 8, fontSize: 14 }}><XCircle size={16} /> {validationErrors.length} error(s)</div>
                  {validationErrors.map((e, i) => <IssueRow key={i} issue={e} />)}
                </div>
              )}
              {validationWarnings.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#92400e', marginBottom: 8, fontSize: 14 }}><AlertTriangle size={16} /> {validationWarnings.length} warning(s)</div>
                  {validationWarnings.map((w, i) => <IssueRow key={i} issue={w} />)}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* Simulation tab */}
      {activeTab === 'simulation' && (
        <div>
          <Card>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={styles.formLabel}>Custom incomes (comma-separated)</label>
                <input type="text" style={styles.formInput} placeholder="e.g. 100000, 250000" value={customIncomes} onChange={(e) => setCustomIncomes(e.target.value)} />
              </div>
              {version.countryCode === 'ZA' && (
                <div style={{ width: 100 }}>
                  <label style={styles.formLabel}>Age</label>
                  <input type="number" style={styles.formInput} value={simAge} onChange={(e) => setSimAge(Number(e.target.value))} />
                </div>
              )}
              <button style={{ ...styles.buttonPrimary, padding: '8px 16px', fontSize: 13 }} onClick={runSimulation}><Play size={13} /> Simulate</button>
            </div>
            <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>Based on <strong>current draft</strong> values.</p>
            {simulation && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ ...styles.table, fontSize: 13 }}>
                  <thead><tr><th style={styles.th}>Annual Income</th><th style={styles.th}>Annual Tax</th><th style={styles.th}>Effective Rate</th><th style={styles.th}>Monthly Tax</th><th style={styles.th}>Bracket</th></tr></thead>
                  <tbody>
                    {simulation.results.map((r, i) => (
                      <tr key={i} style={styles.tr}>
                        <td style={styles.td}>R {r.annualIncome.toLocaleString()}</td>
                        <td style={styles.td}>R {r.annualTax.toLocaleString()}</td>
                        <td style={styles.td}>{(r.effectiveRate * 100).toFixed(2)}%</td>
                        <td style={styles.td}>R {r.monthlyTax.toLocaleString()}</td>
                        <td style={styles.td}>{r.bracketUsed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Compare tab */}
      {activeTab === 'compare' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={runDiff}>
              <ArrowLeftRight size={13} /> Compare to Active
            </button>
          </div>
          {diff === null ? (
            <Card><div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>Click "Compare to Active" to see differences</div></Card>
          ) : diff.metadataChanges.length === 0 && diff.bracketChanges.length === 0 && diff.fieldChanges.length === 0 ? (
            <Card><div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065f46' }}><CheckCircle size={18} /> No differences</div></Card>
          ) : (
            <Card>
              {diff.metadataChanges.length > 0 && <DiffSection title="Metadata" items={diff.metadataChanges.map((c) => ({ label: c.field, from: String(c.previous ?? '—'), to: String(c.current ?? '—') }))} />}
              {diff.bracketChanges.length > 0 && <DiffSection title={`Brackets (+${diff.bracketsAdded} -${diff.bracketsRemoved})`} items={diff.bracketChanges.map((c) => ({ label: `Seq ${c.seqNo} • ${c.field}`, from: String(c.previous ?? '—'), to: String(c.current ?? '—') }))} />}
              {diff.fieldChanges.length > 0 && <DiffSection title="Fields" items={diff.fieldChanges.map((c) => ({ label: c.fieldCode, from: String(c.previous ?? '—'), to: String(c.current ?? '—') }))} />}
            </Card>
          )}
        </div>
      )}

      {/* Impact Analysis tab */}
      {activeTab === 'impact' && version && (
        <ImpactAnalysisPanel
          authoringVersionId={version.id}
          countryCode={version.countryCode as 'ZA' | 'LS'}
          updatedAt={version.updatedAt}
        />
      )}

      {/* Lifecycle tab */}
      {activeTab === 'lifecycle' && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
            <LifecycleCard icon={<Send size={18} />} label="Submit for Approval" desc="Send to reviewer" check={submitCheck} loading={acting} onClick={() => handleLifecycleAction('submit')} />
            <LifecycleCard icon={<Shield size={18} />} label="Approve" desc="Sign off" check={approveCheck} loading={acting} onClick={() => handleLifecycleAction('approve')} />
            <LifecycleCard icon={<Upload size={18} />} label="Publish" desc="Create runtime row" check={publishCheck} loading={acting} onClick={() => setConfirmPublish(true)} accent />
            <LifecycleCard icon={<Archive size={18} />} label="Archive" desc="Remove from workflow" check={archiveCheck} loading={acting} onClick={() => handleLifecycleAction('archive')} danger />
          </div>

          {version.status === 'PUBLISHED' && version.publishedTaxTableSetId && (
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#065f46', fontSize: 14 }}>
                <Check size={16} />
                Published to runtime row <strong>{version.publishedTaxTableSetId.slice(0, 12)}…</strong>
                <a href={`/admin/payroll/tax-tables/runtime?id=${version.publishedTaxTableSetId}`} style={{ color: '#4f46e5', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  View <ExternalLink size={12} />
                </a>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Audit tab */}
      {activeTab === 'audit' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
            <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={loadAudit}><RefreshCw size={13} /> Refresh</button>
          </div>
          {audit.length === 0 ? (
            <Card><div style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No audit events</div></Card>
          ) : (
            <Card>
              {audit.map((ev, i) => (
                <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: i < audit.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 13 }}>
                  <Clock size={14} style={{ color: '#94a3b8', marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: '#1e293b' }}>{ev.eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}</div>
                    <div style={{ color: '#94a3b8', fontSize: 12 }}>{new Date(ev.createdAt).toLocaleString()} — {ev.actorUserId.slice(0, 8)}…</div>
                  </div>
                </div>
              ))}
            </Card>
          )}
        </div>
      )}

      {/* Publish confirmation modal */}
      {confirmPublish && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 480, width: '100%' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Confirm Publish</h3>
            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16 }}>This will create a runtime TaxTableSet row and supersede any existing active row. This cannot be undone.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={styles.formLabel}>Reason (optional)</label>
              <input type="text" style={styles.formInput} value={publishReason} onChange={(e) => setPublishReason(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button style={styles.buttonSecondary} onClick={() => setConfirmPublish(false)}>Cancel</button>
              <button style={{ ...styles.buttonPrimary, opacity: acting ? 0.5 : 1 }} onClick={() => handleLifecycleAction('publish')} disabled={acting}>
                {acting ? 'Publishing…' : 'Publish'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

// ─── Shared sub-components ───
const inputSm: React.CSSProperties = { padding: '4px 8px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 13, outline: 'none' };

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#1e293b' }}>{value}</span>
    </div>
  );
}
function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#64748b' }}>{label}</span>
      <span style={{ fontWeight: 600, color: '#4f46e5', fontSize: 20 }}>{value}</span>
    </div>
  );
}
function IssueRow({ issue }: { issue: ValidationIssue }) {
  const isErr = issue.severity === 'ERROR';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '4px 0', fontSize: 13, color: isErr ? '#991b1b' : '#92400e' }}>
      {isErr ? <XCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
      <span>{issue.message}{issue.field ? ` (${issue.field})` : ''}</span>
    </div>
  );
}
function DiffSection({ title, items }: { title: string; items: { label: string; from: string; to: string }[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>{title}</div>
      {items.map((it, i) => {
        const isAdded = it.from === '—' || it.from === 'null';
        const isRemoved = it.to === '—' || it.to === 'null';
        return (
          <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '6px 8px', borderBottom: '1px solid #f1f5f9', borderRadius: 4, background: isAdded ? '#f0fdf4' : isRemoved ? '#fef2f2' : 'transparent' }}>
            <span style={{ width: 160, color: '#64748b', flexShrink: 0 }}>{it.label}</span>
            {isAdded ? (
              <span style={{ color: '#059669', fontWeight: 500 }}>+ Added: {it.to}</span>
            ) : isRemoved ? (
              <span style={{ color: '#dc2626', fontWeight: 500 }}>- Removed: {it.from}</span>
            ) : (
              <>
                <span style={{ color: '#ef4444', background: '#fef2f2', padding: '0 4px', borderRadius: 3, textDecoration: 'line-through' }}>{it.from}</span>
                <span style={{ color: '#059669', background: '#f0fdf4', padding: '0 4px', borderRadius: 3, fontWeight: 500 }}>{it.to}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
function LifecycleCard({ icon, label, desc, check, loading, onClick, accent, danger }: {
  icon: React.ReactNode; label: string; desc: string;
  check: { allowed: boolean; reason?: string }; loading: boolean;
  onClick: () => void; accent?: boolean; danger?: boolean;
}) {
  const dis = !check.allowed || loading;
  return (
    <button onClick={onClick} disabled={dis} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, padding: 16,
      background: dis ? '#f8fafc' : accent ? '#eef2ff' : danger ? '#fef2f2' : '#fff',
      border: `1px solid ${dis ? '#e2e8f0' : accent ? '#c7d2fe' : danger ? '#fecaca' : '#e2e8f0'}`,
      borderRadius: 10, cursor: dis ? 'not-allowed' : 'pointer', opacity: dis ? 0.6 : 1, textAlign: 'left',
    }}>
      <div style={{ color: accent ? '#4f46e5' : danger ? '#dc2626' : '#64748b' }}>{icon}</div>
      <div style={{ fontWeight: 600, fontSize: 14 }}>{label}</div>
      <div style={{ fontSize: 12, color: '#64748b' }}>{desc}</div>
      {!check.allowed && check.reason && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#f59e0b' }}>
          <AlertCircle size={12} /> {check.reason}
        </div>
      )}
    </button>
  );
}
