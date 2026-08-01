'use client';

import { useState } from 'react';
import { Search } from 'lucide-react';
import { api } from '@/lib/api';
import { isConnectorDemoUiEnabled } from '@/lib/demo-mode';
import { ActionPanel } from '@/components/ui/action-panel';
import { Button } from '@/components/ui/button';
import {
  EXTERNAL_WORKFORCE_LABELS,
  WORKFORCE_DISCOVERY_METRICS,
  WORKFORCE_IMPORT_NARRATIVE,
} from '@/lib/external-workforce-labels';

type Props = {
  canBootstrap: boolean;
  onComplete: () => void | Promise<void>;
};

export function WorkforceImportActions({ canBootstrap, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const discoverWorkforce = async () => {
    try {
      setBusy(true);
      setError('');
      setMessage('');
      const result = await api.syncOracleHcmWorkers();
      const discovered = result.summary?.imported ?? 0;
      if (isConnectorDemoUiEnabled()) {
        const materialized = await api.materializeDemoHcmContractors();
        setMessage(
          WORKFORCE_DISCOVERY_METRICS.discoveryCompleteMaterialized(
            discovered,
            materialized.created,
          ),
        );
      } else {
        setMessage(WORKFORCE_DISCOVERY_METRICS.discoveryComplete(discovered));
      }
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
      setBusy(false);
    }
  };

  if (!canBootstrap) {
    return null;
  }

  return (
    <ActionPanel
      title="Discovery"
      description={WORKFORCE_IMPORT_NARRATIVE.discoveryActionDescription}
      testId="workforce-import-actions"
    >
      <Button
        variant="primary"
        icon={<Search />}
        loading={busy}
        onClick={discoverWorkforce}
        data-testid="demo-sync-oracle-hcm-workers"
      >
        {busy ? WORKFORCE_DISCOVERY_METRICS.discovering : WORKFORCE_DISCOVERY_METRICS.discoverWorkforce}
      </Button>
      {message ? (
        <p
          className="w-full text-sm text-green-800 bg-green-50 border border-green-100 rounded-lg px-4 py-3"
          role="status"
        >
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="w-full text-sm text-red-800 bg-red-50 border border-red-100 rounded-lg px-4 py-3"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </ActionPanel>
  );
}
