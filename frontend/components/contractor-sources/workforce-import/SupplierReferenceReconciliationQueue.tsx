'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  formatObservationSource,
  supplierReferenceAction,
  supplierReferenceProblem,
} from '@/lib/supplier-reconciliation-copy';
import {
  SUPPLIER_RECONCILIATION_LABELS,
  SUPPLIER_RECONCILIATION_NARRATIVE,
} from '@/lib/supplier-reconciliation-labels';

type WorkItem = {
  id: string;
  referenceName: string;
  reconciliationKind: 'POSSIBLE_MATCH' | 'CONFLICT';
  proposedSupplierName: string | null;
  workerCount: number;
  observationSource: string;
};

/** Unresolved supplier references observed during workforce discovery. */
export function SupplierReferenceReconciliationQueue() {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    api
      .listSupplierReconciliationWorkItems()
      .then((rows) => {
        if (!cancelled) setItems(rows ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setError(SUPPLIER_RECONCILIATION_NARRATIVE.loadFailed);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <p className="text-sm text-gray-500">{SUPPLIER_RECONCILIATION_NARRATIVE.loading}</p>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
        {error}
      </p>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center">
        <p className="text-sm font-medium text-gray-800">
          {SUPPLIER_RECONCILIATION_NARRATIVE.emptyTitle}
        </p>
        <p className="text-sm text-gray-600 mt-1">
          {SUPPLIER_RECONCILIATION_NARRATIVE.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div data-testid="supplier-reconciliation-work-queue">
      <p className="text-sm text-gray-600 mb-4">
        {SUPPLIER_RECONCILIATION_LABELS.reviewQueue}:{' '}
        <span className="font-semibold text-gray-900">
          {items.length} work item{items.length === 1 ? '' : 's'}
        </span>
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
            <tr>
              <th className="px-4 py-3">{SUPPLIER_RECONCILIATION_LABELS.supplierReference}</th>
              <th className="px-4 py-3">{SUPPLIER_RECONCILIATION_LABELS.observedIn}</th>
              <th className="px-4 py-3">{SUPPLIER_RECONCILIATION_LABELS.problem}</th>
              <th className="px-4 py-3">{SUPPLIER_RECONCILIATION_LABELS.recommendedAction}</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {items.map((row) => (
              <tr key={row.id} data-testid={`supplier-reference-row-${row.id}`}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{row.referenceName}</p>
                  {row.workerCount > 0 ? (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {row.workerCount} worker{row.workerCount === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {formatObservationSource(row.observationSource)}
                </td>
                <td className="px-4 py-3 text-gray-700">{supplierReferenceProblem(row)}</td>
                <td className="px-4 py-3 text-indigo-700 font-medium">
                  {supplierReferenceAction(row)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
