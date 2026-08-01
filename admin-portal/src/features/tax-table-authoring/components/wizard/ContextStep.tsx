import React, { useEffect, useState } from 'react';
import { Calendar, Globe, FileText, Info } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import { fetchTemplates, fetchVersions, fetchActiveRuntime } from '../../api';
import type { WizardContext } from '../../pages/TaxTableCreateWizardPage';

const TABLE_TYPES: Record<string, string[]> = {
  ZA: ['PAYE'],
  LS: ['PAYE'],
};

const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => String(currentYear + 2 - i));

interface Props {
  context: WizardContext;
  onChange: (ctx: WizardContext) => void;
}

export function ContextStep({ context, onChange }: Props) {
  const [hints, setHints] = useState<{
    hasTemplate: boolean;
    hasActiveRuntime: boolean;
    hasExisting: boolean;
  }>({ hasTemplate: false, hasActiveRuntime: false, hasExisting: false });

  useEffect(() => {
    if (!context.countryCode || !context.tableType || !context.taxYear) return;
    let cancelled = false;
    (async () => {
      try {
        const [templates, existing, runtime] = await Promise.allSettled([
          fetchTemplates(context.countryCode),
          fetchVersions({ countryCode: context.countryCode, tableType: context.tableType }),
          fetchActiveRuntime({ country: context.countryCode, tableType: context.tableType }),
        ]);
        if (cancelled) return;
        const tpls = templates.status === 'fulfilled' ? templates.value : [];
        const hasTemplate = tpls.some(
          (t) =>
            t.countryCode === context.countryCode &&
            t.tableType === context.tableType &&
            t.taxYear === context.taxYear,
        );
        const ex = existing.status === 'fulfilled' ? existing.value : [];
        setHints({
          hasTemplate,
          hasActiveRuntime: runtime.status === 'fulfilled' && !!runtime.value,
          hasExisting: ex.length > 0,
        });
      } catch {
        /* ignore hint errors */
      }
    })();
    return () => { cancelled = true; };
  }, [context.countryCode, context.tableType, context.taxYear]);

  const availableTypes = TABLE_TYPES[context.countryCode] ?? [];

  function set(key: keyof WizardContext, value: string) {
    const next = { ...context, [key]: value };
    if (key === 'countryCode') {
      next.tableType = '';
    }
    onChange(next);
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h3 style={{ ...styles.sectionTitle, marginTop: 0 }}>Set up your tax table context</h3>
      <p style={{ fontSize: 14, color: styles.colors.textSecondary, marginBottom: 24 }}>
        Choose the country, table type, tax year, and effective dates for this new draft.
      </p>

      <Card>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <label style={styles.formLabel}>
              <Globe size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Country
            </label>
            <select
              style={styles.formSelect}
              value={context.countryCode}
              onChange={(e) => set('countryCode', e.target.value)}
            >
              <option value="">Select country…</option>
              <option value="ZA">South Africa</option>
              <option value="LS">Lesotho</option>
            </select>
          </div>

          <div>
            <label style={styles.formLabel}>
              <FileText size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Table Type
            </label>
            <select
              style={{ ...styles.formSelect, opacity: availableTypes.length ? 1 : 0.5 }}
              value={context.tableType}
              onChange={(e) => set('tableType', e.target.value)}
              disabled={!availableTypes.length}
            >
              <option value="">Select type…</option>
              {availableTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 20 }}>
          <div>
            <label style={styles.formLabel}>Tax Year</label>
            <select
              style={styles.formSelect}
              value={context.taxYear}
              onChange={(e) => set('taxYear', e.target.value)}
            >
              <option value="">Select…</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={styles.formLabel}>
              <Calendar size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Effective From
            </label>
            <input
              type="date"
              style={styles.formInput}
              value={context.effectiveFrom}
              onChange={(e) => set('effectiveFrom', e.target.value)}
            />
          </div>
          <div>
            <label style={styles.formLabel}>
              <Calendar size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              Effective To <span style={{ color: styles.colors.textMuted, fontWeight: 400 }}>(optional)</span>
            </label>
            <input
              type="date"
              style={styles.formInput}
              value={context.effectiveTo}
              onChange={(e) => set('effectiveTo', e.target.value)}
            />
          </div>
        </div>
      </Card>

      {/* Hint indicators */}
      {(context.countryCode && context.tableType && context.taxYear) && (
        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <HintRow
            positive={hints.hasTemplate}
            text={hints.hasTemplate
              ? 'Official template available for this configuration'
              : 'No official template found — copy or manual available'}
          />
          <HintRow
            positive={hints.hasActiveRuntime}
            text={hints.hasActiveRuntime
              ? 'Active runtime table exists — copy or compare will be available'
              : 'No active runtime table for this scope'}
          />
          {hints.hasExisting && (
            <HintRow
              positive={true}
              text="Existing authoring versions found — copy flow available"
            />
          )}
        </div>
      )}
    </div>
  );
}

function HintRow({ positive, text }: { positive: boolean; text: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
      <Info size={14} style={{ color: positive ? '#10b981' : '#94a3b8', flexShrink: 0 }} />
      <span style={{ color: positive ? '#065f46' : '#64748b' }}>{text}</span>
    </div>
  );
}
