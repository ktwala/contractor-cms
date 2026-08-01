import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, Copy, Upload, Wrench, Star, AlertCircle, Shield, CheckCircle2, Calendar, Layers, AlertTriangle } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import { fetchTemplateCards, fetchVersions, createFromTemplate, createFromCopy, createManual, createFromImport as createFromImportFn } from '../../api';
import type { WizardContext } from '../../pages/TaxTableCreateWizardPage';
import type { AuthoringVersion, SourceType, TaxTableTemplateCardDto } from '../../types';
import { CardSkeleton } from '../LoadingSkeleton';

interface Props {
  context: WizardContext;
  method: SourceType | '';
  sourceSelection: { templateId?: string; sourceAuthoringId?: string };
  onChange: (patch: { method?: SourceType | ''; sourceSelection?: { templateId?: string; sourceAuthoringId?: string } }) => void;
  onDraftCreated: (draftId: string) => void;
  setError: (e: string | null) => void;
}

interface MethodCard {
  key: SourceType;
  icon: React.ReactNode;
  label: string;
  desc: string;
  effort: string;
  risk: string;
}

const METHODS: MethodCard[] = [
  { key: 'TEMPLATE', icon: <FileSpreadsheet size={24} />, label: 'Use Official Template', desc: 'Load the official bracket template for this tax year', effort: 'Low', risk: 'Low' },
  { key: 'COPY', icon: <Copy size={24} />, label: 'Copy Existing', desc: 'Clone an existing or active version and adjust as needed', effort: 'Low', risk: 'Low' },
  { key: 'IMPORT', icon: <Upload size={24} />, label: 'Import File', desc: 'Upload a CSV, XLSX, or JSON file with bracket data', effort: 'Medium', risk: 'Medium' },
  { key: 'MANUAL', icon: <Wrench size={24} />, label: 'Manual Setup (Advanced)', desc: 'Build brackets from scratch — full control, higher effort', effort: 'High', risk: 'Higher' },
];

import { trackTtaFunnel } from '../../utils/ttaFunnelTelemetry';

function trackCreationMethodSelected(method: SourceType, context: WizardContext, templateId?: string) {
  try {
    window.dispatchEvent(new CustomEvent('tta:telemetry', {
      detail: {
        event: 'tax_table_creation_method_selected',
        method,
        countryCode: context.countryCode,
        tableType: context.tableType,
        taxYear: context.taxYear,
        templateId: templateId ?? null,
      },
    }));
  } catch { /* no-op */ }
}

export function MethodStep({ context, method, sourceSelection, onChange, onDraftCreated, setError }: Props) {
  const [templateCards, setTemplateCards] = useState<TaxTableTemplateCardDto[]>([]);
  const [copySources, setCopySources] = useState<AuthoringVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cards, versions] = await Promise.all([
          fetchTemplateCards({
            countryCode: context.countryCode,
            tableType: context.tableType,
            taxYear: context.taxYear,
          }),
          fetchVersions({ countryCode: context.countryCode, tableType: context.tableType }),
        ]);
        if (cancelled) return;
        setTemplateCards(cards);
        setCopySources(versions.filter((v) => v.status === 'PUBLISHED' || v.status === 'APPROVED' || v.status === 'DRAFT'));
      } catch { /* ignore */ }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [context.countryCode, context.tableType, context.taxYear]);

  const matchingCard = templateCards.find(
    (t) => t.countryCode === context.countryCode && t.taxYear === context.taxYear,
  );

  function defaultMethod(): SourceType {
    if (matchingCard) return 'TEMPLATE';
    if (copySources.length > 0) return 'COPY';
    return 'TEMPLATE';
  }

  useEffect(() => {
    if (!loading && !method) {
      const def = defaultMethod();
      const sel: any = {};
      if (def === 'TEMPLATE' && matchingCard) sel.templateId = matchingCard.templateId;
      onChange({ method: def, sourceSelection: sel });
    }
  }, [loading]);

  function isDisabled(key: SourceType): string | null {
    if (key === 'TEMPLATE' && !matchingCard) return 'No template for this country + tax year';
    if (key === 'COPY' && copySources.length === 0) return 'No existing versions to copy';
    return null;
  }

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      let result;
      if (method === 'TEMPLATE' && sourceSelection.templateId) {
        trackCreationMethodSelected('TEMPLATE', context, sourceSelection.templateId);
        result = await createFromTemplate({
          templateId: sourceSelection.templateId,
          countryCode: context.countryCode,
          tableType: context.tableType,
          taxYear: context.taxYear,
          effectiveFrom: context.effectiveFrom,
          effectiveTo: context.effectiveTo || undefined,
        });
      } else if (method === 'COPY' && sourceSelection.sourceAuthoringId) {
        trackCreationMethodSelected('COPY', context);
        result = await createFromCopy({
          sourceAuthoringId: sourceSelection.sourceAuthoringId,
          taxYear: context.taxYear,
          effectiveFrom: context.effectiveFrom,
          effectiveTo: context.effectiveTo || undefined,
        });
      } else if (method === 'MANUAL') {
        trackCreationMethodSelected('MANUAL', context);
        result = await createManual({
          countryCode: context.countryCode,
          tableType: context.tableType,
          taxYear: context.taxYear,
          effectiveFrom: context.effectiveFrom,
          effectiveTo: context.effectiveTo || undefined,
          brackets: [{ seqNo: 1, bracketFrom: 0, bracketTo: null, marginalRate: 0, baseTax: 0, isOpenEnded: true }],
        });
      } else {
        setError('Please complete your selection');
        setCreating(false);
        return;
      }
      trackTtaFunnel({
        stage: 'draft_created',
        countryCode: context.countryCode,
        tableType: context.tableType,
        taxYear: context.taxYear,
        method,
        draftId: result.id,
      });
      onDraftCreated(result.id);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? e.message ?? 'Failed to create draft');
    }
    setCreating(false);
  }

  const needsSourceSelection = method === 'TEMPLATE' || method === 'COPY';
  const sourceReady =
    (method === 'TEMPLATE' && !!sourceSelection.templateId) ||
    (method === 'COPY' && !!sourceSelection.sourceAuthoringId) ||
    method === 'MANUAL';

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Choose how to create your draft</h3>
      <p style={{ fontSize: 14, color: styles.colors.textSecondary, marginBottom: 24 }}>
        We recommend <strong>Use Official Template</strong> when available. It prefills brackets and fields from the latest official source.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {METHODS.map((m) => {
          const disabled = isDisabled(m.key);
          const selected = method === m.key;
          const recommended = m.key === 'TEMPLATE' && matchingCard;
          const isManual = m.key === 'MANUAL';
          return (
            <button
              key={m.key}
              disabled={!!disabled}
              onClick={() => {
                const sel: any = {};
                if (m.key === 'TEMPLATE' && matchingCard) {
                  sel.templateId = matchingCard.templateId;
                  trackTtaFunnel({
                    stage: 'template_selected',
                    countryCode: context.countryCode,
                    tableType: context.tableType,
                    taxYear: context.taxYear,
                    templateCode: matchingCard.templateCode,
                  });
                }
                onChange({ method: m.key, sourceSelection: sel });
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 8,
                padding: 20,
                background: selected ? '#eef2ff' : '#fff',
                border: selected ? '2px solid #4f46e5' : '1px solid #e2e8f0',
                borderRadius: 12,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.5 : 1,
                textAlign: 'left',
                transition: 'all 0.15s',
                position: 'relative',
              }}
            >
              {recommended && (
                <span
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    background: '#fef3c7',
                    color: '#92400e',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 999,
                  }}
                >
                  <Star size={10} /> Recommended
                </span>
              )}
              <div style={{ color: selected ? '#4f46e5' : '#64748b' }}>{m.icon}</div>
              <div style={{ fontWeight: 600, fontSize: 15, color: '#1e293b' }}>{m.label}</div>
              <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.4 }}>{m.desc}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 12, color: '#94a3b8', marginTop: 4 }}>
                <span>Effort: {m.effort}</span>
                <span>Risk: {m.risk}</span>
              </div>
              {disabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#ef4444', marginTop: 4 }}>
                  <AlertCircle size={12} /> {disabled}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Template info card */}
      {method === 'TEMPLATE' && matchingCard && (
        <TemplateInfoCard card={matchingCard} />
      )}

      {/* Manual warning */}
      {method === 'MANUAL' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8,
          padding: 14, marginBottom: 16,
        }}>
          <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: '#92400e', lineHeight: 1.5 }}>
            <strong>Manual setup is intended for advanced users.</strong> You will need to enter all
            brackets and supplemental fields from scratch. Consider using an official template if one
            is available for your country and tax year.
          </div>
        </div>
      )}

      {/* Source picker for COPY */}
      {method === 'COPY' && (
        <Card>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Select source version to copy</div>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {copySources.map((v) => (
              <button
                key={v.id}
                onClick={() => onChange({ sourceSelection: { sourceAuthoringId: v.id } })}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                  padding: '10px 12px',
                  background: sourceSelection.sourceAuthoringId === v.id ? '#eef2ff' : 'transparent',
                  border: sourceSelection.sourceAuthoringId === v.id ? '1px solid #4f46e5' : '1px solid transparent',
                  borderRadius: 8,
                  cursor: 'pointer',
                  marginBottom: 4,
                  textAlign: 'left',
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>
                    {v.countryCode} • {v.tableType} • {v.taxYear}
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8' }}>
                    Effective {v.effectiveFrom?.slice(0, 10)} • {v.status} • {v.sourceType}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Create button */}
      {(method === 'TEMPLATE' || method === 'COPY' || method === 'MANUAL') && (
        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            style={{
              ...styles.buttonPrimary,
              opacity: sourceReady && !creating ? 1 : 0.5,
              pointerEvents: sourceReady && !creating ? 'auto' : 'none',
            }}
            onClick={handleCreate}
            disabled={!sourceReady || creating}
          >
            {creating ? 'Creating draft…' : 'Create Draft & Continue'}
          </button>
        </div>
      )}

      {method === 'IMPORT' && (
        <Card>
          <div style={styles.cardHeader}>
            <div style={styles.cardTitle}>Import File</div>
          </div>
          <ImportPanel context={context} onDraftCreated={(id) => {
            trackCreationMethodSelected('IMPORT', context);
            onDraftCreated(id);
          }} setError={setError} />
        </Card>
      )}
    </div>
  );
}

function TemplateInfoCard({ card }: { card: TaxTableTemplateCardDto }) {
  return (
    <div style={{
      background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12,
      padding: 20, marginBottom: 16,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Shield size={18} style={{ color: '#16a34a' }} />
        <span style={{ fontWeight: 600, fontSize: 15, color: '#166534' }}>{card.title}</span>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 3,
          background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 600,
          padding: '2px 8px', borderRadius: 999,
        }}>
          <CheckCircle2 size={10} /> Official
        </span>
        {card.recommended && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3,
            background: '#fef3c7', color: '#92400e', fontSize: 11, fontWeight: 600,
            padding: '2px 8px', borderRadius: 999,
          }}>
            <Star size={10} /> Recommended
          </span>
        )}
      </div>
      {card.description && (
        <p style={{ fontSize: 13, color: '#166534', margin: '0 0 12px', lineHeight: 1.4 }}>
          {card.description}
        </p>
      )}
      <div style={{ display: 'flex', gap: 24, fontSize: 13, color: '#15803d', flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Layers size={14} /> {card.bracketCount} brackets
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <Calendar size={14} /> Effective {card.defaultEffectiveFrom}
        </span>
        <span>Source: {card.sourceReference}</span>
        <span>v{card.version}</span>
      </div>
      {card.includedFieldLabels.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {card.includedFieldLabels.map((label) => (
            <span key={label} style={{
              background: '#dcfce7', color: '#166534', fontSize: 11, fontWeight: 500,
              padding: '2px 8px', borderRadius: 6,
            }}>
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ImportPanel({
  context,
  onDraftCreated,
  setError,
}: {
  context: WizardContext;
  onDraftCreated: (id: string) => void;
  setError: (e: string | null) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  async function handleFile(f: File) {
    setFile(f);
    setErrors([]);
    setPreview(null);
    try {
      const text = await f.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed.brackets) || parsed.brackets.length === 0) {
        setErrors(['File must contain a "brackets" array with at least one entry']);
        return;
      }
      const errs: string[] = [];
      parsed.brackets.forEach((b: any, i: number) => {
        if (typeof b.bracketFrom !== 'number') errs.push(`Row ${i + 1}: bracketFrom must be a number`);
        if (typeof b.marginalRate !== 'number') errs.push(`Row ${i + 1}: marginalRate must be a number`);
      });
      if (errs.length) {
        setErrors(errs);
        return;
      }
      setPreview(parsed.brackets);
    } catch {
      setErrors(['Could not parse file. Ensure it is valid JSON with a "brackets" array.']);
    }
  }

  async function handleCreate() {
    if (!preview) return;
    setCreating(true);
    try {
      const result = await createFromImportFn({
        countryCode: context.countryCode,
        tableType: context.tableType,
        taxYear: context.taxYear,
        effectiveFrom: context.effectiveFrom,
        effectiveTo: context.effectiveTo || undefined,
        sourceReference: file?.name,
        brackets: preview.map((b, i) => ({
          seqNo: b.seqNo ?? i + 1,
          bracketFrom: b.bracketFrom,
          bracketTo: b.bracketTo ?? null,
          marginalRate: b.marginalRate,
          baseTax: b.baseTax ?? 0,
          isOpenEnded: b.isOpenEnded ?? false,
        })),
      });
      onDraftCreated(result.id);
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Import failed');
    }
    setCreating(false);
  }

  return (
    <div>
      <div
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: 12,
          padding: 32,
          textAlign: 'center',
          marginBottom: 16,
          cursor: 'pointer',
        }}
        onClick={() => document.getElementById('tta-import-file')?.click()}
      >
        <Upload size={28} style={{ color: '#94a3b8', margin: '0 auto 8px' }} />
        <p style={{ fontSize: 14, color: '#64748b' }}>
          {file ? file.name : 'Click to upload JSON file with bracket data'}
        </p>
        <input
          id="tta-import-file"
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {errors.length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 12, marginBottom: 12 }}>
          {errors.map((e, i) => (
            <div key={i} style={{ fontSize: 13, color: '#991b1b', marginBottom: 2 }}>
              <AlertCircle size={12} style={{ verticalAlign: -2, marginRight: 4 }} />
              {e}
            </div>
          ))}
        </div>
      )}

      {preview && (
        <div>
          <div style={{ fontSize: 13, color: '#065f46', marginBottom: 8 }}>
            {preview.length} bracket(s) parsed successfully
          </div>
          <button
            style={{ ...styles.buttonPrimary, opacity: creating ? 0.5 : 1 }}
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creating…' : 'Create Draft from Import'}
          </button>
        </div>
      )}
    </div>
  );
}
