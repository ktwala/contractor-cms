'use client';

import { useState } from 'react';
import { ClipboardCheck, Search, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { isConnectorDemoUiEnabled } from '@/lib/demo-mode';
import { Button } from '@/components/ui/button';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';

type Props = {
  onComplete: () => void | Promise<void>;
  canManage: boolean;
};

export function HcmConnectorDemoBar({ onComplete, canManage }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!isConnectorDemoUiEnabled() || !canManage) {
    return null;
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    try {
      setBusy(label);
      setError('');
      setMessage('');
      await fn();
      await onComplete();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? String((e as { response?: { data?: { message?: string } } }).response?.data?.message)
          : e instanceof Error
            ? e.message
            : 'Action failed';
      setError(msg || 'Action failed');
    } finally {
      setBusy(null);
    }
  };

  const syncDemoWorkers = () =>
    run('sync', async () => {
      const result = await api.syncOracleHcmWorkers();
      const imported = result.summary?.imported ?? 0;
      const materialized = await api.materializeDemoHcmContractors();
      setMessage(
        `Import complete — ${imported} worker(s) staged from mock Oracle HCM. ` +
          `Materialized ${materialized.created} external worker(s) into the registry.`,
      );
    });

  const detectDrift = () =>
    run('drift', async () => {
      const result = await api.detectOracleHcmSourceDrift();
      setMessage(
        `${EXTERNAL_WORKFORCE_LABELS.assessWorkforce} complete — detected ${result.detected ?? 0}, updated ${result.updated ?? 0}. ` +
          `Flagship: unsponsored external worker → operational governance remediation → policy restriction.`,
      );
    });

  return (
    <section
      className="card border-2 border-dashed border-violet-200 bg-violet-50/40"
      data-testid="hcm-connector-demo-bar"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-violet-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4" aria-hidden />
            HCM workforce import (mock Oracle API)
          </h2>
          <p className="text-xs text-violet-800/80 mt-2 max-w-xl leading-relaxed">
            One-time import path: staging, worker linking, then external worker registry. Operational
            governance (sponsor, policy restrictions) is {EXTERNAL_WORKFORCE_LABELS.productShort}-authoritative after materialize.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={<Search />}
            loading={busy === 'sync'}
            disabled={busy != null && busy !== 'sync'}
            onClick={syncDemoWorkers}
            data-testid="demo-sync-oracle-hcm-workers"
          >
            {busy === 'sync' ? 'Importing…' : 'Import demo HCM workers'}
          </Button>
          <Button
            variant="secondary"
            icon={<ClipboardCheck />}
            loading={busy === 'drift'}
            disabled={busy != null && busy !== 'drift'}
            onClick={detectDrift}
            data-testid="demo-hcm-drift-detect"
          >
            {busy === 'drift'
              ? EXTERNAL_WORKFORCE_LABELS.assessingWorkforce
              : EXTERNAL_WORKFORCE_LABELS.assessWorkforce}
          </Button>
        </div>
      </div>
      {message ? (
        <p className="mt-4 text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-4 py-3" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-800 bg-red-50 border border-red-100 rounded-lg px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
