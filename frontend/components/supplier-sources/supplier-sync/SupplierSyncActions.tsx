'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import {
  SUPPLIER_SYNCHRONIZATION_LABELS,
  SUPPLIER_SYNCHRONIZATION_NARRATIVE,
} from '@/lib/supplier-synchronization-labels';
import { ActionPanel } from '@/components/ui/action-panel';
import { Button } from '@/components/ui/button';

type Props = {
  canSync: boolean;
  onComplete: () => void | Promise<void>;
};

export function SupplierSyncActions({ canSync, onComplete }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const synchronizeSuppliers = async () => {
    try {
      setBusy(true);
      setError('');
      setMessage('');
      const result = await api.syncOracleSuppliers();
      const imported = result.summary?.imported ?? result.summary?.recordsImported ?? 0;
      setMessage(SUPPLIER_SYNCHRONIZATION_NARRATIVE.syncCompleteToast(imported));
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

  if (!canSync) {
    return null;
  }

  return (
    <ActionPanel
      title="Synchronization"
      description={SUPPLIER_SYNCHRONIZATION_NARRATIVE.syncActionDescription}
      testId="supplier-sync-actions"
    >
      <Button
        variant="primary"
        icon={<RefreshCw />}
        loading={busy}
        onClick={synchronizeSuppliers}
        data-testid="demo-sync-oracle-suppliers"
      >
        {busy ? 'Synchronizing…' : SUPPLIER_SYNCHRONIZATION_LABELS.synchronizeSuppliers}
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
