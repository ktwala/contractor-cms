'use client';

import Link from 'next/link';
import {
  OPERATIONAL_TRUST_LABELS,
  operationalTrustResolutionHref,
} from '@/lib/operational-trust-labels';

export type SupplierGovernanceImpactFinding = {
  supplierId: string;
  supplierName: string;
  operationalTrustStatus: string;
  operationalTrustLabel: string;
  affectedWorkerCount: number;
  impactSummary: string;
  resolutionAction: string;
};

type Props = {
  finding: SupplierGovernanceImpactFinding;
};

/** Live projection of Supplier Governance Operational Trust impact into Workforce Discovery. */
export function SupplierGovernanceImpactCard({ finding }: Props) {
  const resolutionHref = operationalTrustResolutionHref(finding.operationalTrustStatus);
  const resolutionLinkLabel = `${OPERATIONAL_TRUST_LABELS.workerBlockResolvePrefix} ${
    finding.operationalTrustStatus === 'PENDING_APPROVAL'
      ? 'Operational Trust Queue'
      : 'Operational Trust Management'
  }`;

  return (
    <article
      className="rounded-lg border border-amber-200 bg-amber-50 p-4"
      data-testid="supplier-governance-impact-card"
      data-supplier-id={finding.supplierId}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber-900/80">
        {OPERATIONAL_TRUST_LABELS.supplierGovernanceFindingTitle}
      </p>
      <dl className="mt-3 grid gap-3 text-sm text-amber-950 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">Supplier</dt>
          <dd className="font-semibold text-base">{finding.supplierName}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">
            {OPERATIONAL_TRUST_LABELS.operationalTrustColumn}
          </dt>
          <dd className="font-medium">{finding.operationalTrustLabel}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">
            {OPERATIONAL_TRUST_LABELS.affectedWorkersColumn}
          </dt>
          <dd className="font-medium">{finding.affectedWorkerCount}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">
            {OPERATIONAL_TRUST_LABELS.impactColumn}
          </dt>
          <dd>{finding.impactSummary}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wide text-amber-800/80">
            {OPERATIONAL_TRUST_LABELS.resolutionColumn}
          </dt>
          <dd className="font-medium">{finding.resolutionAction}</dd>
        </div>
      </dl>
      <Link
        href={resolutionHref}
        className="inline-block text-sm font-medium text-indigo-700 hover:text-indigo-900 mt-4"
        data-testid="supplier-governance-impact-link"
      >
        {resolutionLinkLabel}
      </Link>
    </article>
  );
}
