'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  OPERATIONAL_TRUST_LABELS,
  oracleProcurementLabel,
  operationalTrustLabel,
  operationalTrustBadgeClass,
} from '@/lib/operational-trust-labels';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

type SupplierRow = {
  id: string;
  companyName?: string;
  tradingName?: string;
  status: string;
  externalSupplierId?: string | null;
  sourceSyncStatus?: string | null;
};

function displayName(row: SupplierRow): string {
  return row.tradingName || row.companyName || row.externalSupplierId || 'Supplier';
}

/** Oracle-linked suppliers — Operational Trust state after supplier assessment. */
export function OperationalSupplierReviewTable() {
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const supplierRes = await api.getSuppliers({ page: 1, limit: 100 });
      const supplierItems = (supplierRes.data ?? []) as SupplierRow[];
      const oracleLinked = supplierItems
        .filter((s) => s.externalSupplierId)
        .sort((a, b) => displayName(a).localeCompare(displayName(b)));
      setSuppliers(oracleLinked);
    } catch {
      setError('Could not load operational supplier review.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useOperationalTrustChanged(() => {
    void loadSuppliers();
  });

  if (loading) {
    return <p className="text-sm text-gray-500">Loading operational suppliers…</p>;
  }

  if (error) {
    return (
      <p className="text-sm text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-3 py-2">
        {error}
      </p>
    );
  }

  if (suppliers.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 p-6 text-center">
        <p className="text-sm font-medium text-gray-800">No operational suppliers yet</p>
        <p className="text-sm text-gray-600 mt-1">
          Synchronize suppliers from Oracle Supplier Portal, then run supplier assessment to evaluate
          Operational Trust readiness.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border" data-testid="operational-supplier-review-table">
      <table className="min-w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500 text-left">
          <tr>
            <th className="px-4 py-2">Supplier</th>
            <th className="px-4 py-2">{OPERATIONAL_TRUST_LABELS.oracleColumn}</th>
            <th className="px-4 py-2">{OPERATIONAL_TRUST_LABELS.operationalTrustColumn}</th>
          </tr>
        </thead>
        <tbody className="divide-y bg-white">
          {suppliers.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-medium text-gray-900">{displayName(row)}</td>
              <td className="px-4 py-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  {oracleProcurementLabel(row.externalSupplierId)}
                </span>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${operationalTrustBadgeClass(row.status)}`}
                >
                  {operationalTrustLabel(row.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
