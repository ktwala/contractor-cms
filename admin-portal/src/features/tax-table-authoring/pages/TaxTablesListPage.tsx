import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Filter, RefreshCw, Zap } from 'lucide-react';
import * as styles from '../../../styles/common';
import { Page, Card } from '../../../ui/layout';
import { fetchVersions, fetchTemplateCards, createFromTemplate } from '../api';
import { StatusBadge, SourceBadge } from '../components/StatusBadge';
import { TableSkeleton } from '../components/LoadingSkeleton';
import { ErrorBanner } from '../components/ErrorBanner';
import { useTtaPermissions } from '../hooks/useTtaPermissions';
import { trackTtaFunnel } from '../utils/ttaFunnelTelemetry';
import { classifyPageState } from '../../../utils/pageState';
import { usePageStateTelemetry } from '../../../utils/pageStateTelemetry';
import { PageStateView } from '../../../ui/PageStateViews';
import type { AuthoringVersion, AuthoringStatus, TaxTableTemplateCardDto } from '../types';

const TABS: { key: string; label: string; statuses: AuthoringStatus[] }[] = [
  { key: 'drafts', label: 'Drafts', statuses: ['DRAFT'] },
  { key: 'pending', label: 'Pending Approval', statuses: ['PENDING_APPROVAL'] },
  { key: 'published', label: 'Published', statuses: ['PUBLISHED'] },
  { key: 'archived', label: 'Archived', statuses: ['ARCHIVED'] },
  { key: 'all', label: 'All', statuses: [] },
];

export default function TaxTablesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate } = useTtaPermissions();

  const activeTab = searchParams.get('tab') ?? 'drafts';
  const filterCountry = searchParams.get('country') ?? '';
  const filterType = searchParams.get('type') ?? '';
  const filterYear = searchParams.get('year') ?? '';

  const [versions, setVersions] = useState<AuthoringVersion[]>([]);
  const [templateCards, setTemplateCards] = useState<TaxTableTemplateCardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);
  const [autoCreating, setAutoCreating] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const currentTab = TABS.find((t) => t.key === activeTab) ?? TABS[0];

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const filters: Record<string, string> = {};
      if (currentTab.statuses.length === 1) filters.status = currentTab.statuses[0];
      if (filterCountry) filters.countryCode = filterCountry;
      if (filterType) filters.tableType = filterType;
      if (filterYear) filters.taxYear = filterYear;
      const [data, cards] = await Promise.all([
        fetchVersions(filters),
        fetchTemplateCards(),
      ]);
      setVersions(data);
      setTemplateCards(cards);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterCountry, filterType, filterYear]);

  async function handleAutoSetup(card: TaxTableTemplateCardDto) {
    setAutoCreating(card.templateId);
    setActionError(null);
    try {
      trackTtaFunnel({
        stage: 'template_selected',
        countryCode: card.countryCode,
        tableType: card.tableType,
        taxYear: card.taxYear,
        templateCode: card.templateCode,
      });
      const result = await createFromTemplate({
        templateId: card.templateId,
        countryCode: card.countryCode,
        tableType: card.tableType,
        taxYear: card.taxYear,
        effectiveFrom: card.defaultEffectiveFrom,
      });
      trackTtaFunnel({
        stage: 'draft_created',
        countryCode: card.countryCode,
        tableType: card.tableType,
        taxYear: card.taxYear,
        method: 'TEMPLATE',
        draftId: result.id,
      });
      navigate(`/admin/payroll/tax-tables/authoring/${result.id}`);
    } catch (e: any) {
      setActionError(e?.response?.data?.message ?? e?.response?.data?.error?.message ?? 'Auto-setup failed');
    }
    setAutoCreating(null);
  }

  useEffect(() => {
    void loadData();
  }, [loadData]);

  function setTab(key: string) {
    const params = new URLSearchParams(searchParams);
    params.set('tab', key);
    setSearchParams(params);
  }

  function setFilter(name: string, value: string) {
    const params = new URLSearchParams(searchParams);
    if (value) params.set(name, value);
    else params.delete(name);
    setSearchParams(params);
  }

  const pageState = classifyPageState({ loading, error: loadError, data: versions });
  usePageStateTelemetry('tta.list', 'tax_table_authoring', pageState);

  const displayed =
    currentTab.statuses.length === 0
      ? versions
      : versions.filter((v) => currentTab.statuses.includes(v.status as AuthoringStatus));

  return (
    <Page
      title="Tax Table Authoring"
      subtitle="Manage tax table drafts, approvals, and publishing"
      actions={
        pageState.kind === 'ready' || pageState.kind === 'empty'
          ? canCreate
            ? (
                <button
                  type="button"
                  data-testid="tta-create-tax-table"
                  style={styles.buttonPrimary}
                  onClick={() => navigate('/admin/payroll/tax-tables/create')}
                >
                  <Plus size={16} /> Create Tax Table
                </button>
              )
            : undefined
          : undefined
      }
    >
      {pageState.kind === 'loading' ? (
        <Card><TableSkeleton rows={6} /></Card>
      ) : pageState.kind !== 'ready' && pageState.kind !== 'empty' ? (
        <PageStateView
          state={pageState}
          page="tta.list"
          module="tax_table_authoring"
          onRetry={loadData}
        />
      ) : (
        <>
          {/* Action error banner (only for auto-setup or similar user actions) */}
          <ErrorBanner error={actionError} onDismiss={() => setActionError(null)} />

          {/* Tabs */}
          <div style={styles.tabBar}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                style={{ ...styles.tabButton, ...(activeTab === tab.key ? styles.tabActive : {}) }}
                onClick={() => setTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <Filter size={16} style={{ color: styles.colors.textMuted }} />
            <select
              style={{ ...styles.formSelect, width: 140 }}
              value={filterCountry}
              onChange={(e) => setFilter('country', e.target.value)}
            >
              <option value="">All Countries</option>
              <option value="ZA">South Africa</option>
              <option value="LS">Lesotho</option>
            </select>
            <select
              style={{ ...styles.formSelect, width: 160 }}
              value={filterType}
              onChange={(e) => setFilter('type', e.target.value)}
            >
              <option value="">All Table Types</option>
              <option value="PAYE">PAYE</option>
              <option value="PAYE_ANNUAL">PAYE Annual</option>
            </select>
            <input
              style={{ ...styles.formInput, width: 120 }}
              placeholder="Tax Year"
              value={filterYear}
              onChange={(e) => setFilter('year', e.target.value)}
            />
            <button
              style={{ ...styles.buttonSecondary, padding: '8px 12px' }}
              onClick={loadData}
              title="Refresh"
            >
              <RefreshCw size={14} />
            </button>
          </div>

          <Card>
            {displayed.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <div style={{ margin: '0 auto 16px', width: 56, height: 56, borderRadius: 16, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Plus size={28} style={{ color: '#4f46e5' }} />
                </div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
                  No tax table versions found
                </p>
                <p style={{ fontSize: 14, color: styles.colors.textMuted, marginBottom: 20, maxWidth: 480, margin: '0 auto 20px' }}>
                  Set up PAYE instantly from an official template, or use the wizard for more control.
                </p>
                {canCreate && templateCards.length > 0 && (
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
                    {templateCards.map((card) => (
                      <button
                        key={card.templateId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 20px', borderRadius: 10,
                          background: '#4f46e5', color: '#fff', border: 'none',
                          cursor: autoCreating ? 'wait' : 'pointer',
                          opacity: autoCreating && autoCreating !== card.templateId ? 0.5 : 1,
                          fontWeight: 600, fontSize: 14, transition: 'all 0.15s',
                        }}
                        disabled={!!autoCreating}
                        onClick={() => handleAutoSetup(card)}
                      >
                        <Zap size={16} />
                        {autoCreating === card.templateId
                          ? 'Setting up…'
                          : `Set up ${card.countryCode} PAYE`}
                      </button>
                    ))}
                  </div>
                )}
                {canCreate && (
                  <button
                    style={{ ...styles.buttonSecondary, fontSize: 13 }}
                    onClick={() => navigate('/admin/payroll/tax-tables/create')}
                  >
                    Use Wizard for more options
                  </button>
                )}
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Country</th>
                      <th style={styles.th}>Type</th>
                      <th style={styles.th}>Tax Year</th>
                      <th style={styles.th}>Effective From</th>
                      <th style={styles.th}>Status</th>
                      <th style={styles.th}>Source</th>
                      <th style={styles.th}>Updated</th>
                      <th style={styles.th}>Created By</th>
                      <th style={styles.th}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayed.map((v) => (
                      <tr key={v.id} style={styles.tr}>
                        <td style={styles.td}>{v.countryCode}</td>
                        <td style={styles.td}>{v.tableType}</td>
                        <td style={styles.td}>{v.taxYear}</td>
                        <td style={styles.td}>{v.effectiveFrom?.slice(0, 10)}</td>
                        <td style={styles.td}>
                          <StatusBadge status={v.status as AuthoringStatus} />
                        </td>
                        <td style={styles.td}>
                          <SourceBadge source={v.sourceType as any} />
                        </td>
                        <td style={styles.td}>
                          {new Date(v.updatedAt).toLocaleDateString()}
                        </td>
                        <td style={styles.td}>
                          <span style={{ fontSize: 12, color: styles.colors.textMuted }}>
                            {v.createdByUserId?.slice(0, 8)}…
                          </span>
                        </td>
                        <td style={styles.td}>
                          <button
                            style={{ ...styles.buttonSecondary, padding: '4px 12px', fontSize: 13 }}
                            onClick={() => navigate(`/admin/payroll/tax-tables/authoring/${v.id}`)}
                          >
                            Open
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </Page>
  );
}
