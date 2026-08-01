import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import * as styles from '../styles/common';
import { Page, Card, CardHeader, Banner } from '../ui/layout';
import { useAccess } from '../hooks/useAccess';
import {
  LS_READINESS_SUFFIX,
  LS_OPERATOR_BOOTSTRAP_HEADING,
  lsStatutoryConfigsPillLabel,
} from './statutoryReadiness/lsBootstrapReadinessCopy';
import {
  ZA_READINESS_SUFFIX,
  ZA_OPERATOR_BOOTSTRAP_HEADING,
  zaStatutoryConfigsPillLabel,
} from './statutoryReadiness/zaBootstrapReadinessCopy';

interface TaxTableSet {
  id: string;
  country: string;
  tableType: string;
  taxYear: string;
  displayName?: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: string;
}

interface StatutoryConfigEntry {
  id: string;
  country: string;
  configType: string;
  effectiveFrom: string;
  effectiveTo?: string;
  status: string;
  data: Record<string, unknown>;
}

interface ReadinessPillar {
  ready: boolean;
  rows?: unknown[];
  expected_types?: string[];
  checks?: Array<{ configType: string; ready: boolean; id: string | null }>;
}

interface CountryReadiness {
  country: string;
  as_of: string;
  pack_registry: ReadinessPillar;
  paye_tax_table: ReadinessPillar;
  statutory_configs: ReadinessPillar;
  readiness: { snapshot_engine_ready: boolean; operator_bootstrap_complete: boolean };
  notes?: Record<string, string>;
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  ACTIVE: { bg: '#f0fdf4', text: '#16a34a' },
  DRAFT: { bg: '#fffbeb', text: '#d97706' },
  DEPRECATED: { bg: '#f1f5f9', text: '#94a3b8' },
  READY: { bg: '#dcfce7', text: '#15803d' },
  GAP: { bg: '#ffedd5', text: '#c2410c' },
};

function Chip({ label }: { label: string }) {
  const c = STATUS_COLORS[label] ?? { bg: '#f1f5f9', text: '#475569' };
  return <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: c.bg, color: c.text }}>{label}</span>;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function ReadinessPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 12px',
        borderRadius: 10,
        border: `1px solid ${styles.colors.border}`,
        background: ok ? '#f0fdf4' : '#fff7ed',
        marginBottom: 8,
        fontSize: 13,
      }}
    >
      <span style={{ fontWeight: 600 }}>{label}</span>
      <Chip label={ok ? 'READY' : 'GAP'} />
    </div>
  );
}

export default function StatutoryConfig() {
  const { canAny } = useAccess();
  const [taxTables, setTaxTables] = useState<TaxTableSet[]>([]);
  const [configs, setConfigs] = useState<StatutoryConfigEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zaReadiness, setZaReadiness] = useState<CountryReadiness | null>(null);
  const [lsReadiness, setLsReadiness] = useState<CountryReadiness | null>(null);
  const [readinessError, setReadinessError] = useState<string | null>(null);

  const rbacDataOk = canAny(['tax:read', 'tax_table_authoring_view']);

  useEffect(() => {
    (async () => {
      try {
        const [ttRes, lsRes, zaRes, zr, lr] = await Promise.all([
          api.get('/admin/tax-tables').catch(() => ({ data: { items: [] } })),
          api.get('/admin/tax-tables/statutory-configs/LS').catch(() => ({ data: [] })),
          api.get('/admin/tax-tables/statutory-configs/ZA').catch(() => ({ data: [] })),
          api.get('/admin/statutory-readiness/ZA').catch(() => null),
          api.get('/admin/statutory-readiness/LS').catch(() => null),
        ]);
        const ttData = ttRes.data?.data ?? ttRes.data?.items ?? ttRes.data ?? [];
        setTaxTables(Array.isArray(ttData) ? ttData : []);
        const lsArr = lsRes.data?.data ?? lsRes.data ?? [];
        const zaArr = zaRes.data?.data ?? zaRes.data ?? [];
        const lsConfigs: StatutoryConfigEntry[] = (Array.isArray(lsArr) ? lsArr : []).map((c: any) => ({ ...c, country: 'LS' }));
        const zaConfigs: StatutoryConfigEntry[] = (Array.isArray(zaArr) ? zaArr : []).map((c: any) => ({ ...c, country: 'ZA' }));
        setConfigs([...zaConfigs, ...lsConfigs]);

        if (zr?.data?.data) setZaReadiness(zr.data.data as CountryReadiness);
        if (lr?.data?.data) setLsReadiness(lr.data.data as CountryReadiness);
        const zOk = !!zr?.data?.data;
        const lOk = !!lr?.data?.data;
        if (!zOk || !lOk) {
          const parts: string[] = [];
          if (!zOk) parts.push('ZA readiness');
          if (!lOk) parts.push('LS readiness');
          setReadinessError(`Could not load: ${parts.join(', ')}`);
        } else {
          setReadinessError(null);
        }
      } catch {
        setError('Failed to load statutory configuration');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <Page title="Statutory Configuration"><div style={styles.loadingContainer}><div style={styles.loadingSpinner} /></div><style>{styles.spinKeyframes}</style></Page>;

  function renderCountryReadiness(r: CountryReadiness | null, country: 'ZA' | 'LS') {
    if (!r) {
      return (
        <div style={{ padding: 16, color: styles.colors.textMuted, fontSize: 13 }}>
          Readiness data unavailable.
        </div>
      );
    }
    const expectedTypes = r.statutory_configs.expected_types ?? [];
    const readinessSuffix = country === 'ZA' ? ZA_READINESS_SUFFIX : LS_READINESS_SUFFIX;
    const statutoryPillLabel =
      country === 'ZA' ? zaStatutoryConfigsPillLabel(expectedTypes) : lsStatutoryConfigsPillLabel(expectedTypes);
    const operatorHeading =
      country === 'ZA' ? ZA_OPERATOR_BOOTSTRAP_HEADING : LS_OPERATOR_BOOTSTRAP_HEADING;
    return (
      <div style={{ padding: 4 }}>
        <div style={{ fontSize: 12, color: styles.colors.textMuted, marginBottom: 10 }}>
          As of <strong>{r.as_of}</strong> (UTC). {readinessSuffix}
        </div>
        <ReadinessPill ok={r.pack_registry.ready} label="Pack registry (compute pack)" />
        <ReadinessPill ok={r.paye_tax_table.ready} label="PAYE TaxTableSet" />
        <ReadinessPill ok={r.statutory_configs.ready} label={statutoryPillLabel} />
        <div style={{ marginTop: 12, padding: 10, borderRadius: 10, background: '#f8fafc', fontSize: 12, color: styles.colors.textSecondary }}>
          <strong>Snapshot engine:</strong>{' '}
          {r.readiness.snapshot_engine_ready ? 'Ready (pack + PAYE)' : 'Not ready — check seed or effective dates.'}
          <br />
          <strong>{operatorHeading}</strong>{' '}
          {r.readiness.operator_bootstrap_complete ? 'Complete' : 'Incomplete — see runbook.'}
        </div>
      </div>
    );
  }

  return (
    <Page
      title="Statutory Configuration"
      subtitle="Tax tables, contribution rates, and country-specific statutory rules for payroll calculation."
      actions={
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link to="/admin/payroll/tax-tables" style={{ ...styles.buttonPrimary, textDecoration: 'none' }}>
            Tax Table Authoring
          </Link>
          <Link to="/admin/tax-tables" style={{ ...styles.buttonSecondary, textDecoration: 'none' }}>
            Legacy tax tables
          </Link>
        </div>
      }
    >
      {error && <Banner variant="error">{error}</Banner>}
      {readinessError && <Banner variant="error">{readinessError}</Banner>}

      <Banner variant="info">
        <strong>Governance quick reference</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, fontSize: 13 }}>
          <li>
            <strong>RBAC seed ≠ statutory seed:</strong> <code>npm run db:seed</code> vs <code>npx ts-node prisma/seeds/tax-tables.seed.ts</code>.
          </li>
          <li>
            <strong>TTA publish does not create</strong> <code>pack_registry</code> rows — bootstrap packs via statutory seed (or approved ops process).
          </li>
          <li>
            <strong>Payrun snapshot</strong> needs an active compute pack and an active PAYE table for the pay date (see readiness cards below).
          </li>
          <li>
            Full operator runbook: <code style={{ fontSize: 12 }}>docs/payroll/TAX_TABLE_GOVERNANCE_RUNBOOK.md</code>
          </li>
        </ul>
      </Banner>

      <Card>
        <CardHeader title="Bootstrap & snapshot readiness" subtitle="PackRouter inputs for ZA and LS" />
        <ReadinessPill ok={rbacDataOk} label="Session can load statutory admin APIs (tax:read or tax_table_authoring_view)" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div style={{ border: `1px solid ${styles.colors.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>South Africa (ZA)</div>
            <div data-testid="statutory-readiness-za">{renderCountryReadiness(zaReadiness, 'ZA')}</div>
          </div>
          <div style={{ border: `1px solid ${styles.colors.border}`, borderRadius: 12, padding: 12 }}>
            <div style={{ fontWeight: 800, marginBottom: 8 }}>Lesotho (LS)</div>
            <div data-testid="statutory-readiness-ls">{renderCountryReadiness(lsReadiness, 'LS')}</div>
          </div>
        </div>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Tax Tables', value: taxTables.length, color: '#2563eb', desc: 'PAYE bracket tables by country' },
          {
            label: 'Contribution Rules',
            value: configs.length,
            color: '#7c3aed',
            desc: 'Statutory rate rows by country and config type (ZA may include UIF/SDL/MTC when seeded).',
          },
        ].map((card) => (
          <div key={card.label} style={{ padding: 20, background: '#fff', borderRadius: 12, border: `1px solid ${styles.colors.border}` }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: card.color }}>{card.value}</div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{card.label}</div>
            <div style={{ fontSize: 12, color: styles.colors.textMuted }}>{card.desc}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader title="Tax Tables" right={<Link to="/admin/tax-tables" style={{ fontSize: 12, color: styles.colors.primary, textDecoration: 'none' }}>View All &rarr;</Link>} />
        {taxTables.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: styles.colors.textMuted, fontSize: 13 }}>
            No tax tables configured. <Link to="/admin/tax-tables" style={{ color: styles.colors.primary }}>Create one</Link> or run the seed script.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 16px' }}>Country</th>
                  <th style={{ padding: '8px 16px' }}>Type</th>
                  <th style={{ padding: '8px 16px' }}>Tax Year</th>
                  <th style={{ padding: '8px 16px' }}>Effective From</th>
                  <th style={{ padding: '8px 16px' }}>Effective To</th>
                  <th style={{ padding: '8px 16px' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {taxTables.map((tt) => (
                  <tr key={tt.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{tt.country}</td>
                    <td style={{ padding: '8px 16px' }}>{tt.tableType}</td>
                    <td style={{ padding: '8px 16px' }}>{tt.taxYear}</td>
                    <td style={{ padding: '8px 16px' }}>{fmtDate(tt.effectiveFrom)}</td>
                    <td style={{ padding: '8px 16px' }}>{fmtDate(tt.effectiveTo)}</td>
                    <td style={{ padding: '8px 16px' }}><Chip label={tt.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Contribution & Statutory Rules" />
        {configs.length === 0 ? (
          <div style={{ padding: 20, textAlign: 'center', color: styles.colors.textMuted, fontSize: 13 }}>
            No statutory contribution rules configured. Run the seed script to load default rules.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e2e8f0', textAlign: 'left' }}>
                  <th style={{ padding: '8px 16px' }}>Country</th>
                  <th style={{ padding: '8px 16px' }}>Type</th>
                  <th style={{ padding: '8px 16px' }}>Effective From</th>
                  <th style={{ padding: '8px 16px' }}>Status</th>
                  <th style={{ padding: '8px 16px' }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 16px', fontWeight: 600 }}>{c.country}</td>
                    <td style={{ padding: '8px 16px' }}>{c.configType}</td>
                    <td style={{ padding: '8px 16px' }}>{fmtDate(c.effectiveFrom)}</td>
                    <td style={{ padding: '8px 16px' }}><Chip label={c.status} /></td>
                    <td style={{ padding: '8px 16px', fontSize: 11, color: styles.colors.textMuted, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {JSON.stringify(c.data).substring(0, 80)}...
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
