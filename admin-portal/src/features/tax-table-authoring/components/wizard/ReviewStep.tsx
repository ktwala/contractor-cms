import React, { useCallback, useEffect, useState } from 'react';
import { Save, RotateCcw, Plus, Trash2, AlertTriangle } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import { fetchVersion, updateBrackets, updateFields } from '../../api';
import { StatusBadge, SourceBadge } from '../StatusBadge';
import { TableSkeleton } from '../LoadingSkeleton';
import type { AuthoringVersion, AuthoringBracket, AuthoringField } from '../../types';

interface Props {
  draftId: string;
  setError: (e: string | null) => void;
}

export function ReviewStep({ draftId, setError }: Props) {
  const [version, setVersion] = useState<AuthoringVersion | null>(null);
  const [brackets, setBrackets] = useState<AuthoringBracket[]>([]);
  const [fields, setFields] = useState<AuthoringField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const v = await fetchVersion(draftId);
      setVersion(v);
      setBrackets(v.brackets ?? []);
      setFields(v.fields ?? []);
      setDirty(false);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to load draft');
    }
    setLoading(false);
  }, [draftId]);

  useEffect(() => { void load(); }, [load]);

  function updateBracket(index: number, field: keyof AuthoringBracket, value: any) {
    setBrackets((prev) =>
      prev.map((b, i) => (i === index ? { ...b, [field]: value } : b)),
    );
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
    setFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, fieldValue: value } : f)),
    );
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const bracketPayload = brackets.map((b, i) => ({
        seqNo: i + 1,
        bracketFrom: Number(b.bracketFrom),
        bracketTo: b.bracketTo != null ? Number(b.bracketTo) : null,
        marginalRate: Number(b.marginalRate),
        baseTax: Number(b.baseTax),
        isOpenEnded: !!b.isOpenEnded,
      }));
      await updateBrackets(draftId, bracketPayload);
      if (fields.length > 0) {
        await updateFields(
          draftId,
          fields.map((f) => ({ fieldCode: f.fieldCode, fieldValue: f.fieldValue })),
        );
      }
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Failed to save');
    }
    setSaving(false);
  }

  if (loading || !version) {
    return <TableSkeleton rows={6} />;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>
      {/* Main editing area */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Brackets</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={load}>
              <RotateCcw size={13} /> Reset
            </button>
            <button style={{ ...styles.buttonSecondary, padding: '6px 12px', fontSize: 13 }} onClick={addBracket}>
              <Plus size={13} /> Add Row
            </button>
            {dirty && (
              <button
                style={{ ...styles.buttonPrimary, padding: '6px 16px', fontSize: 13, opacity: saving ? 0.5 : 1 }}
                onClick={save}
                disabled={saving}
              >
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
                  <th style={styles.th}></th>
                </tr>
              </thead>
              <tbody>
                {brackets.map((b, i) => {
                  const baseMismatch =
                    b.derivedBaseTax != null &&
                    Math.abs(Number(b.baseTax) - Number(b.derivedBaseTax)) > 0.01;
                  return (
                    <tr key={b.id} style={{ ...styles.tr, background: baseMismatch ? '#fffbeb' : undefined }}>
                      <td style={styles.td}>{i + 1}</td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          value={b.bracketFrom}
                          onChange={(e) => updateBracket(i, 'bracketFrom', Number(e.target.value))}
                          style={{ ...inputStyle, width: 110 }}
                        />
                      </td>
                      <td style={styles.td}>
                        {b.isOpenEnded ? (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>∞</span>
                        ) : (
                          <input
                            type="number"
                            value={b.bracketTo ?? ''}
                            onChange={(e) =>
                              updateBracket(i, 'bracketTo', e.target.value ? Number(e.target.value) : null)
                            }
                            style={{ ...inputStyle, width: 110 }}
                          />
                        )}
                      </td>
                      <td style={styles.td}>
                        <input
                          type="number"
                          step="0.001"
                          value={b.marginalRate}
                          onChange={(e) => updateBracket(i, 'marginalRate', Number(e.target.value))}
                          style={{ ...inputStyle, width: 90 }}
                        />
                      </td>
                      <td style={styles.td}>
                        {advancedMode ? (
                          <div>
                            <input
                              type="number"
                              value={b.baseTax}
                              onChange={(e) => updateBracket(i, 'baseTax', Number(e.target.value))}
                              style={{ ...inputStyle, width: 110, borderColor: baseMismatch ? '#f59e0b' : undefined }}
                            />
                            {baseMismatch && (
                              <input
                                type="text"
                                placeholder="Override reason…"
                                value={b.baseTaxOverrideReason ?? ''}
                                onChange={(e) => updateBracket(i, 'baseTaxOverrideReason', e.target.value)}
                                style={{ ...inputStyle, width: 110, marginTop: 4, fontSize: 11 }}
                              />
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: 13, color: baseMismatch ? '#92400e' : '#1e293b' }}>
                            {Number(b.baseTax).toLocaleString()}
                            {baseMismatch && (
                              <AlertTriangle size={12} style={{ color: '#f59e0b', marginLeft: 4, verticalAlign: -2 }} />
                            )}
                          </span>
                        )}
                      </td>
                      <td style={styles.td}>
                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                          {b.derivedBaseTax != null ? Number(b.derivedBaseTax).toLocaleString() : '—'}
                        </span>
                      </td>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={b.isOpenEnded}
                          onChange={(e) => updateBracket(i, 'isOpenEnded', e.target.checked)}
                        />
                      </td>
                      <td style={styles.td}>
                        <button
                          onClick={() => removeBracket(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Supplemental Fields */}
        {fields.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Supplemental Fields</h3>
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {fields.map((f, i) => (
                  <div key={f.id}>
                    <label style={styles.formLabel}>{formatFieldCode(f.fieldCode)}</label>
                    <input
                      type="text"
                      value={typeof f.fieldValue === 'object' ? JSON.stringify(f.fieldValue) : String(f.fieldValue ?? '')}
                      onChange={(e) => {
                        try {
                          updateField(i, JSON.parse(e.target.value));
                        } catch {
                          updateField(i, e.target.value);
                        }
                      }}
                      style={styles.formInput}
                    />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div style={{ position: 'sticky', top: 100 }}>
        <Card>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Draft Info</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <StatusBadge status={version.status as any} />
            <SourceBadge source={version.sourceType as any} />
          </div>
          <InfoRow label="Country" value={version.countryCode} />
          <InfoRow label="Type" value={version.tableType} />
          <InfoRow label="Tax Year" value={version.taxYear} />
          <InfoRow label="Effective" value={version.effectiveFrom?.slice(0, 10)} />
          {version.sourceReference && <InfoRow label="Source" value={version.sourceReference} />}
        </Card>

        <div style={{ marginTop: 12 }}>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: '#64748b',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={advancedMode}
              onChange={(e) => setAdvancedMode(e.target.checked)}
            />
            Advanced mode (edit base tax)
          </label>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '4px 8px',
  border: '1px solid #e2e8f0',
  borderRadius: 6,
  fontSize: 13,
  outline: 'none',
};

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
      <span style={{ color: '#94a3b8' }}>{label}</span>
      <span style={{ fontWeight: 500, color: '#1e293b' }}>{value}</span>
    </div>
  );
}

function formatFieldCode(code: string): string {
  return code
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
