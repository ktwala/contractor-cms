'use client';

import Link from 'next/link';
import {
  OPERATIONAL_TRUST_LABELS,
  buildOperationalTrustWorkerBlock,
} from '@/lib/operational-trust-labels';

type Props = {
  supplierName: string;
  supplierStatus: string;
  blockedWorkerCount?: number;
  className?: string;
  /** External Workers form uses the shorter cannot-operationalize heading. */
  variant?: 'governance' | 'form';
};

/** Shown when workforce operationalization is blocked by supplier Operational Trust state. */
export function OperationalTrustWorkerBlock({
  supplierName,
  supplierStatus,
  blockedWorkerCount,
  className = '',
  variant = 'governance',
}: Props) {
  const block = buildOperationalTrustWorkerBlock({
    supplierName,
    supplierStatus,
    blockedWorkerCount,
  });
  const heading =
    variant === 'form'
      ? OPERATIONAL_TRUST_LABELS.workerBlockTitle
      : block.heading;

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 p-4 ${className}`}
      data-testid="operational-trust-worker-block"
    >
      <p className="text-sm font-semibold text-amber-950">{heading}</p>
      <dl className="mt-3 space-y-2 text-sm text-amber-900">
        <div>
          <dt className="sr-only">Supplier</dt>
          <dd className="font-medium text-base text-amber-950">{block.supplierName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">
            {OPERATIONAL_TRUST_LABELS.operationalTrustColumn}
          </dt>
          <dd className="font-medium">{block.operationalTrustLabel}</dd>
        </div>
        {block.workersBlockedLabel ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-amber-800/80">
              {OPERATIONAL_TRUST_LABELS.affectedWorkersColumn}
            </dt>
            <dd className="font-medium">{block.workersBlockedLabel}</dd>
          </div>
        ) : null}
        <div>
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">Action</dt>
          <dd>{block.action}</dd>
        </div>
      </dl>
      <Link
        href={block.resolutionHref}
        className="inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900 mt-3"
        data-testid="operational-trust-resolution-link"
      >
        {block.resolutionLinkLabel}
      </Link>
    </div>
  );
}
