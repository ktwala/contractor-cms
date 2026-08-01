'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  OPERATIONAL_TRUST_LABELS,
  OPERATIONAL_TRUST_ROUTES,
  operationalTrustBadgeClass,
  operationalTrustLabel,
} from '@/lib/operational-trust-labels';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

type TrustEvent = {
  kind: 'GRANTED' | 'RESTORED' | 'SUSPENDED' | 'DENIED';
  label: string;
  actorDisplayName: string | null;
  occurredAt: string;
  reason: string | null;
};

type Evidence = {
  currentStateLabel: string;
  oracleProcurementLabel: string | null;
  events: TrustEvent[];
  latestGrant: TrustEvent | null;
  latestSuspension: TrustEvent | null;
};

type Props = {
  supplierId: string;
  supplierStatus: string;
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function highlightEvent(
  supplierStatus: string,
  evidence: Evidence | null,
): TrustEvent | null {
  if (!evidence) return null;
  if (supplierStatus === 'ACTIVE') {
    return evidence.latestGrant;
  }
  if (supplierStatus === 'SUSPENDED') {
    return evidence.latestSuspension;
  }
  return evidence.latestSuspension ?? evidence.latestGrant;
}

export function SupplierOperationalTrustPanel({ supplierId, supplierStatus }: Props) {
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEvidence = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSupplierOperationalTrustEvidence(supplierId);
      setEvidence(data as Evidence);
    } catch {
      setEvidence(null);
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    void loadEvidence();
  }, [loadEvidence, supplierStatus]);

  useOperationalTrustChanged((detail) => {
    if (detail.supplierId !== supplierId) return;
    void loadEvidence();
  });

  const highlight = highlightEvent(supplierStatus, evidence);
  const timelineEvents = [...(evidence?.events ?? [])].reverse();

  return (
    <section data-testid="supplier-operational-trust-panel">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">
        {OPERATIONAL_TRUST_LABELS.evidenceSectionTitle}
      </h2>
      <div className="rounded-lg border bg-white p-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          {evidence?.oracleProcurementLabel ? (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {OPERATIONAL_TRUST_LABELS.oracleColumn}: {evidence.oracleProcurementLabel}
            </span>
          ) : null}
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${operationalTrustBadgeClass(supplierStatus)}`}
            data-testid="supplier-operational-trust-state"
          >
            {operationalTrustLabel(supplierStatus)}
          </span>
        </div>

        {loading ? (
          <p className="text-sm text-gray-500">Loading Operational Trust evidence…</p>
        ) : highlight ? (
          <div className="text-sm text-gray-700 space-y-4">
            <div className="space-y-2">
              <p className="font-semibold text-gray-900">{highlight.label}</p>
              {highlight.actorDisplayName ? (
                <p>
                  <span className="text-gray-500">By:</span> {highlight.actorDisplayName}
                </p>
              ) : null}
              <p>
                <span className="text-gray-500">Date:</span> {formatDate(highlight.occurredAt)}
              </p>
              {highlight.reason ? (
                <p>
                  <span className="text-gray-500">Reason:</span> {highlight.reason}
                </p>
              ) : null}
              {highlight.kind === 'GRANTED' ? (
                <p className="text-green-800">{OPERATIONAL_TRUST_LABELS.afterGrantResult}</p>
              ) : null}
              {highlight.kind === 'RESTORED' ? (
                <p className="text-green-800">{OPERATIONAL_TRUST_LABELS.afterRestoreResult}</p>
              ) : null}
            </div>
            {timelineEvents.length > 1 ? (
              <div className="border-t pt-3 space-y-1" data-testid="operational-trust-timeline">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
                  Decision history
                </p>
                {timelineEvents.map((event, index) => (
                  <div key={`${event.occurredAt}-${index}`}>
                    <div className="text-sm py-2">
                      <p className="font-medium text-gray-900">{event.label}</p>
                      {event.actorDisplayName ? (
                        <p className="text-gray-600">By: {event.actorDisplayName}</p>
                      ) : null}
                      <p className="text-gray-600">{formatDate(event.occurredAt)}</p>
                      {event.reason ? (
                        <p className="text-gray-600">
                          <span className="text-gray-500">Reason:</span> {event.reason}
                        </p>
                      ) : null}
                    </div>
                    {index < timelineEvents.length - 1 ? (
                      <p className="text-gray-400 text-center text-xs" aria-hidden>
                        ↓
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-gray-600">{OPERATIONAL_TRUST_LABELS.evidenceEmpty}</p>
        )}

        {supplierStatus === 'PENDING_APPROVAL' ? (
          <Link href={OPERATIONAL_TRUST_ROUTES.queue} className="text-sm text-indigo-600 hover:text-indigo-800">
            {OPERATIONAL_TRUST_LABELS.openQueue}
          </Link>
        ) : supplierStatus === 'SUSPENDED' ? (
          <Link
            href={OPERATIONAL_TRUST_ROUTES.managementSuspended}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {OPERATIONAL_TRUST_LABELS.openManagement}
          </Link>
        ) : (
          <Link
            href={OPERATIONAL_TRUST_ROUTES.managementGranted}
            className="text-sm text-indigo-600 hover:text-indigo-800"
          >
            {OPERATIONAL_TRUST_LABELS.openManagement}
          </Link>
        )}
      </div>
    </section>
  );
}

export default SupplierOperationalTrustPanel;

