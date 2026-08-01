import React, { useEffect, useState, useCallback } from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';
import * as styles from '../../../../styles/common';
import { Card } from '../../../../ui/layout';
import { fetchPayGroups, reviewImpactAnalysisRun, exportImpactAnalysisRunCsv } from '../../api';
import { useImpactAnalysis } from '../../hooks/useImpactAnalysis';
import { useImpactAnalysisRuns } from '../../hooks/useImpactAnalysisRuns';
import { downloadBlob } from '../../utils/downloadBlob';
import { ErrorBanner } from '../ErrorBanner';
import { ImpactAnalysisFilters } from './ImpactAnalysisFilters';
import { ImpactAnalysisSummaryCards } from './ImpactAnalysisSummaryCards';
import { ImpactAnalysisDistribution } from './ImpactAnalysisDistribution';
import { ImpactAnalysisResultsTable } from './ImpactAnalysisResultsTable';
import { ImpactAnalysisTopMovers } from './ImpactAnalysisTopMovers';
import { ImpactAnalysisStatusCard } from './ImpactAnalysisStatusCard';
import { ImpactAnalysisRunHistory } from './ImpactAnalysisRunHistory';
import { ImpactAnalysisReviewPanel } from './ImpactAnalysisReviewPanel';

interface Props {
  authoringVersionId: string;
  countryCode: 'ZA' | 'LS';
  updatedAt?: string;
}

export function ImpactAnalysisPanel({ authoringVersionId, countryCode, updatedAt }: Props) {
  const { loading, data, error, execute, clear } = useImpactAnalysis();
  const { runs, latest, loading: loadingRuns, refresh: refreshRuns } = useImpactAnalysisRuns(authoringVersionId);
  const [payGroups, setPayGroups] = useState<any[]>([]);
  const [filters, setFilters] = useState<{
    basisMode: 'LAST_CLOSED_PAYRUN' | 'PAYRUN_ID';
    payGroupId: string;
    payrunId: string;
    limit: number;
    affectedOnly: boolean;
    minAbsoluteDelta: number;
  }>({
    basisMode: 'LAST_CLOSED_PAYRUN',
    payGroupId: '',
    payrunId: '',
    limit: 400,
    affectedOnly: false,
    minAbsoluteDelta: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const pg = await fetchPayGroups(countryCode);
        setPayGroups(pg);
        if (pg.length > 0 && !filters.payGroupId) {
          setFilters((f) => ({ ...f, payGroupId: pg[0].id }));
        }
      } catch { /* ignore */ }
    })();
  }, [countryCode]);

  async function handleRun() {
    await execute({
      authoringVersionId,
      countryCode,
      basisMode: filters.basisMode,
      payGroupId: filters.payGroupId || undefined,
      payrunId: filters.payrunId || undefined,
      limit: filters.limit,
      affectedOnly: filters.affectedOnly,
      minAbsoluteDelta: filters.minAbsoluteDelta,
    });
    void refreshRuns();
  }

  const handleExport = useCallback(async (runId: string) => {
    try {
      const blob = await exportImpactAnalysisRunCsv(runId);
      downloadBlob(blob, `tax_table_impact_analysis_${countryCode}_${runId}.csv`);
    } catch { /* ignore */ }
  }, [countryCode]);

  const handleReviewSubmit = useCallback(async (payload: { reviewStatus: string; reviewComment?: string }) => {
    if (!latest?.latestRunId) return;
    await reviewImpactAnalysisRun(latest.latestRunId, payload as any);
    void refreshRuns();
  }, [latest?.latestRunId, refreshRuns]);

  const staleChecker = useCallback((run: any) => {
    if (!updatedAt) return false;
    return new Date(updatedAt).getTime() > new Date(run.runAt).getTime();
  }, [updatedAt]);

  const currency = countryCode === 'ZA' ? 'R' : 'M';

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <BarChart3 size={20} style={{ color: '#4f46e5' }} />
        <h3 style={{ ...styles.sectionTitle, marginTop: 0, marginBottom: 0 }}>Impact Analysis</h3>
      </div>

      <ImpactAnalysisStatusCard latest={latest} />

      <div style={{ marginTop: 16 }}>
        <div
          style={{
            fontSize: 13,
            color: '#64748b',
            marginBottom: 16,
            padding: '8px 12px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
          }}
        >
          Compares PAYE outcomes between the <strong>active runtime</strong> tax table and this <strong>draft</strong> using real employee data. Runs are persisted for export and review.
        </div>

        <ImpactAnalysisFilters
          value={filters}
          onChange={setFilters}
          payGroups={payGroups}
          onRun={handleRun}
          loading={loading}
        />
      </div>

      <ErrorBanner error={error} onDismiss={clear} />

      {data?.summary.warnings && data.summary.warnings.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {data.summary.warnings.map((w, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: '#92400e',
                padding: '4px 0',
              }}
            >
              <AlertTriangle size={13} /> {w}
            </div>
          ))}
        </div>
      )}

      {data && (
        <>
          <ImpactAnalysisSummaryCards summary={data.summary} currency={currency} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
            <ImpactAnalysisDistribution buckets={data.summary.buckets} />
            <ImpactAnalysisTopMovers
              biggestIncrease={data.summary.biggestIncrease}
              biggestDecrease={data.summary.biggestDecrease}
              rows={data.rows}
              currency={currency}
            />
          </div>

          <div style={{ marginTop: 20 }}>
            <ImpactAnalysisResultsTable rows={data.rows} currency={currency} />
          </div>
        </>
      )}

      {runs.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <ImpactAnalysisRunHistory
            runs={runs}
            onExport={handleExport}
            staleChecker={staleChecker}
          />
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <ImpactAnalysisReviewPanel
          runId={latest?.latestRunId}
          latestReviewStatus={latest?.latestReviewStatus}
          stale={latest?.stale}
          onSubmit={handleReviewSubmit}
          disabled={!latest?.latestRunId}
        />
      </div>
    </div>
  );
}
