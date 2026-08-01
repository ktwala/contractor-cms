'use client';

import { useState } from 'react';
import { ClipboardCheck, RefreshCw, Sparkles } from 'lucide-react';
import { api } from '@/lib/api';
import { isConnectorDemoUiEnabled } from '@/lib/demo-mode';
import { Button } from '@/components/ui/button';
import { SUPPLIER_SYNCHRONIZATION_LABELS } from '@/lib/supplier-synchronization-labels';

type Props = {
  onComplete: () => void | Promise<void>;
  canManage: boolean;
};

export function SupplierConnectorDemoBar({ onComplete, canManage }: Props) {
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

  const syncDemoSuppliers = () =>
    run('sync', async () => {
      const result = await api.syncOracleSuppliers();
      const imported = result.summary?.imported ?? result.summary?.recordsImported ?? 0;
      setMessage(
        `Sync complete — ${imported} supplier record(s) from mock Oracle. ` +
          `Expect 5 for the MTN story. Then assess suppliers and use Complete MTN demo story on the Governance tab.`,
      );
    });

  const detectDrift = () =>
    run('drift', async () => {
      const result = await api.detectOracleSourceDrift();
      setMessage(
        `${SUPPLIER_SYNCHRONIZATION_LABELS.assessSuppliers} complete — detected ${result.detected ?? 0}, updated ${result.updated ?? 0}.`,
      );
    });

  const isBusy = busy != null;

  return (
    <section
      className="card border-2 border-dashed border-indigo-200 bg-indigo-50/40"
      data-testid="supplier-connector-demo-bar"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold text-indigo-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4" aria-hidden />
            Oracle supplier sync (demo)
          </h2>
          <p className="text-xs text-indigo-800/80 mt-2 max-w-xl leading-relaxed">
            Oracle Procurement remains supplier master. Sync imports metadata into a snapshot;
            assess and complete the MTN demo story on the Governance tab.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="primary"
            icon={<RefreshCw />}
            loading={busy === 'sync'}
            disabled={isBusy && busy !== 'sync'}
            onClick={syncDemoSuppliers}
            data-testid="demo-sync-oracle-suppliers"
          >
            {busy === 'sync' ? 'Syncing…' : SUPPLIER_SYNCHRONIZATION_LABELS.synchronizeSuppliers}
          </Button>
          <Button
            variant="secondary"
            icon={<ClipboardCheck />}
            loading={busy === 'drift'}
            disabled={isBusy && busy !== 'drift'}
            onClick={detectDrift}
            data-testid="demo-supplier-drift-detect"
          >
            {busy === 'drift'
              ? SUPPLIER_SYNCHRONIZATION_LABELS.assessingSupplierReadiness
              : SUPPLIER_SYNCHRONIZATION_LABELS.assessSuppliers}
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
