import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  ArrowLeftRight,
} from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import {
  validateVersion,
  simulateVersion,
  diffAgainstRuntime,
  fetchVersion,
} from '../../api';
import { CardSkeleton } from '../LoadingSkeleton';
import { trackTtaFunnel } from '../../utils/ttaFunnelTelemetry';
import type { ValidationIssue, SimulationResult, DiffResult, AuthoringVersion } from '../../types';

interface Props {
  draftId: string;
  setError: (e: string | null) => void;
}

const DEFAULT_INCOMES = [60000, 120000, 250000, 500000, 1000000, 2000000];

export function ValidateStep({ draftId, setError }: Props) {
  const [version, setVersion] = useState<AuthoringVersion | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[] | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [diff, setDiff] = useState<DiffResult | null>(null);
  const [loadingV, setLoadingV] = useState(false);
  const [loadingSim, setLoadingSim] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [customIncomes, setCustomIncomes] = useState('');
  const [simAge, setSimAge] = useState(35);

  useEffect(() => {
    (async () => {
      try {
        const v = await fetchVersion(draftId);
        setVersion(v);
      } catch { /* ignore */ }
    })();
  }, [draftId]);

  const runValidation = useCallback(async () => {
    setLoadingV(true);
    setError(null);
    try {
      const result = await validateVersion(draftId);
      setIssues(result.issues ?? []);
      const validationErrors = (result.issues ?? []).filter((i) => i.severity === 'ERROR');
      if (validationErrors.length === 0) {
        trackTtaFunnel({ stage: 'validation_passed', draftId });
      }
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Validation failed');
    }
    setLoadingV(false);
  }, [draftId]);

  const runSimulation = useCallback(async () => {
    setLoadingSim(true);
    setError(null);
    try {
      const incomes =
        customIncomes.trim()
          ? customIncomes.split(',').map((s) => Number(s.trim())).filter((n) => !isNaN(n))
          : DEFAULT_INCOMES;
      const result = await simulateVersion(draftId, { annualIncomes: incomes, age: simAge });
      setSimulation(result);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Simulation failed');
    }
    setLoadingSim(false);
  }, [draftId, customIncomes, simAge]);

  const runDiff = useCallback(async () => {
    setLoadingDiff(true);
    setError(null);
    try {
      const result = await diffAgainstRuntime(draftId);
      setDiff(result);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Diff failed');
    }
    setLoadingDiff(false);
  }, [draftId]);

  useEffect(() => { void runValidation(); }, [runValidation]);

  const errors = issues?.filter((i) => i.severity === 'ERROR') ?? [];
  const warnings = issues?.filter((i) => i.severity === 'WARNING') ?? [];
  const hasBlockers = errors.length > 0;

  return (
    <div>
      {/* Validation */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Validation Summary</h3>
          <button
            style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13, opacity: loadingV ? 0.5 : 1 }}
            onClick={runValidation}
            disabled={loadingV}
          >
            <RefreshCw size={13} /> Revalidate
          </button>
        </div>

        {loadingV ? (
          <CardSkeleton />
        ) : issues === null ? null : issues.length === 0 ? (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#065f46' }}>
              <CheckCircle size={20} />
              <span style={{ fontWeight: 600 }}>All checks passed — no errors or warnings</span>
            </div>
          </Card>
        ) : (
          <Card>
            {hasBlockers && (
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#991b1b',
                    marginBottom: 8,
                  }}
                >
                  <XCircle size={16} />
                  {errors.length} publish blocker{errors.length !== 1 ? 's' : ''}
                </div>
                {errors.map((e, i) => (
                  <IssueRow key={i} issue={e} />
                ))}
              </div>
            )}
            {warnings.length > 0 && (
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#92400e',
                    marginBottom: 8,
                  }}
                >
                  <AlertTriangle size={16} />
                  {warnings.length} warning{warnings.length !== 1 ? 's' : ''}
                </div>
                {warnings.map((w, i) => (
                  <IssueRow key={i} issue={w} />
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Simulation */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Simulation</h3>
          <button
            style={{ ...styles.buttonPrimary, padding: '6px 16px', fontSize: 13, opacity: loadingSim ? 0.5 : 1 }}
            onClick={runSimulation}
            disabled={loadingSim}
          >
            <Play size={13} /> {loadingSim ? 'Running…' : 'Run Simulation'}
          </button>
        </div>

        <Card>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label style={styles.formLabel}>Custom incomes (comma-separated, optional)</label>
              <input
                type="text"
                style={styles.formInput}
                placeholder="e.g. 100000, 250000, 500000"
                value={customIncomes}
                onChange={(e) => setCustomIncomes(e.target.value)}
              />
            </div>
            {version?.countryCode === 'ZA' && (
              <div style={{ width: 100 }}>
                <label style={styles.formLabel}>Age</label>
                <input
                  type="number"
                  style={styles.formInput}
                  value={simAge}
                  onChange={(e) => setSimAge(Number(e.target.value))}
                />
              </div>
            )}
          </div>
          <p style={{ fontSize: 12, color: '#94a3b8', marginBottom: 12 }}>
            Results are based on <strong>current draft</strong> — not the active runtime table.
          </p>

          {simulation && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ ...styles.table, fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Annual Income</th>
                    <th style={styles.th}>Annual Tax</th>
                    <th style={styles.th}>Effective Rate</th>
                    <th style={styles.th}>Monthly Tax</th>
                    <th style={styles.th}>Bracket</th>
                  </tr>
                </thead>
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

      {/* Compare to Active */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Compare to Active Runtime</h3>
          <button
            style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13, opacity: loadingDiff ? 0.5 : 1 }}
            onClick={runDiff}
            disabled={loadingDiff}
          >
            <ArrowLeftRight size={13} /> {loadingDiff ? 'Loading…' : 'Compare'}
          </button>
        </div>

        {diff && (
          <Card>
            {diff.metadataChanges.length === 0 &&
             diff.bracketChanges.length === 0 &&
             diff.fieldChanges.length === 0 ? (
              <div style={{ color: '#065f46', fontSize: 14 }}>
                <CheckCircle size={16} style={{ verticalAlign: -3, marginRight: 6 }} />
                No differences from active runtime table.
              </div>
            ) : (
              <div>
                {diff.metadataChanges.length > 0 && (
                  <DiffSection title="Metadata Changes" items={diff.metadataChanges.map((c) => ({
                    label: c.field,
                    from: String(c.previous ?? '—'),
                    to: String(c.current ?? '—'),
                  }))} />
                )}
                {diff.bracketChanges.length > 0 && (
                  <DiffSection
                    title={`Bracket Changes (${diff.bracketsAdded} added, ${diff.bracketsRemoved} removed)`}
                    items={diff.bracketChanges.map((c) => ({
                      label: `Seq ${c.seqNo} → ${c.field}`,
                      from: String(c.previous ?? '—'),
                      to: String(c.current ?? '—'),
                    }))}
                  />
                )}
                {diff.fieldChanges.length > 0 && (
                  <DiffSection title="Field Changes" items={diff.fieldChanges.map((c) => ({
                    label: c.fieldCode,
                    from: String(c.previous ?? '—'),
                    to: String(c.current ?? '—'),
                  }))} />
                )}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const isError = issue.severity === 'ERROR';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '6px 0',
        fontSize: 13,
        color: isError ? '#991b1b' : '#92400e',
      }}
    >
      {isError ? <XCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} />}
      <div>
        <span>{issue.message}</span>
        {issue.field && (
          <span style={{ marginLeft: 8, fontSize: 11, color: '#94a3b8' }}>({issue.field})</span>
        )}
      </div>
    </div>
  );
}

function DiffSection({ title, items }: { title: string; items: { label: string; from: string; to: string }[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: '#1e293b' }}>{title}</div>
      {items.map((item, i) => {
        const isAdded = item.from === '—' || item.from === 'null';
        const isRemoved = item.to === '—' || item.to === 'null';
        return (
          <div key={i} style={{ display: 'flex', gap: 12, fontSize: 13, padding: '6px 8px', borderBottom: '1px solid #f1f5f9', borderRadius: 4, background: isAdded ? '#f0fdf4' : isRemoved ? '#fef2f2' : 'transparent' }}>
            <span style={{ width: 160, color: '#64748b', flexShrink: 0 }}>{item.label}</span>
            {isAdded ? (
              <span style={{ color: '#059669', fontWeight: 500 }}>+ Added: {item.to}</span>
            ) : isRemoved ? (
              <span style={{ color: '#dc2626', fontWeight: 500 }}>- Removed: {item.from}</span>
            ) : (
              <>
                <span style={{ color: '#ef4444', background: '#fef2f2', padding: '0 4px', borderRadius: 3, textDecoration: 'line-through' }}>{item.from}</span>
                <span style={{ color: '#059669', background: '#f0fdf4', padding: '0 4px', borderRadius: 3, fontWeight: 500 }}>{item.to}</span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
