'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import {
  supplierGovernanceBucketHref,
  supplierGovernanceBucketHint,
  supplierGovernanceBucketLabel,
  type SupplierGovernanceBucketKey,
} from '@/lib/supplier-governance-navigation';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';
import { Link2, FileWarning, CheckCircle2, PauseCircle } from 'lucide-react';

export type GovernanceDashboardBuckets = {
  synced: number;
  pendingEvidence: number;
  active: number;
  suspended: number;
};

type Props = {
  className?: string;
};

export default function SupplierGovernanceDashboard({ className = '' }: Props) {
  const { user } = useAuth();
  const [buckets, setBuckets] = useState<GovernanceDashboardBuckets | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    try {
      const data = await api.getSupplierGovernanceDashboard();
      setBuckets(data.buckets);
      setTotal(data.oracleLinkedTotal);
      setError('');
    } catch {
      setError('Could not load governance dashboard');
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useOperationalTrustChanged(() => {
    void loadDashboard();
  });

  if (error) {
    return (
      <p className={`text-sm text-amber-700 ${className}`} role="status">
        {error}
      </p>
    );
  }

  if (!buckets) {
    return (
      <p className={`text-sm text-gray-500 ${className}`}>Loading governance summary…</p>
    );
  }

  const tenantAuthority = user?.tenantAuthority;
  const cards: Array<{
    key: SupplierGovernanceBucketKey;
    value: number;
    icon: typeof Link2;
    className: string;
  }> = [
    {
      key: 'synced',
      value: buckets.synced,
      icon: Link2,
      className: 'bg-sky-50 text-sky-900 border-sky-100 hover:border-sky-300',
    },
    {
      key: 'pendingEvidence',
      value: buckets.pendingEvidence,
      icon: FileWarning,
      className: 'bg-amber-50 text-amber-900 border-amber-100 hover:border-amber-300',
    },
    {
      key: 'active',
      value: buckets.active,
      icon: CheckCircle2,
      className: 'bg-green-50 text-green-900 border-green-100 hover:border-green-300',
    },
    {
      key: 'suspended',
      value: buckets.suspended,
      icon: PauseCircle,
      className: 'bg-gray-50 text-gray-900 border-gray-100 hover:border-gray-300',
    },
  ];

  return (
    <div className={className}>
      <GovernanceOverviewHeader total={total} />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const href = supplierGovernanceBucketHref(card.key, tenantAuthority);
          const label = supplierGovernanceBucketLabel(card.key, tenantAuthority);
          const hint = supplierGovernanceBucketHint(card.key, tenantAuthority);
          const disabled = card.value === 0;

          return (
            <Link
              key={card.key}
              href={disabled ? '#' : href}
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
              aria-disabled={disabled}
              className={`rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                card.className
              } ${disabled ? 'opacity-60 cursor-default pointer-events-none' : 'cursor-pointer shadow-sm hover:shadow'}`}
              data-testid={`governance-bucket-${card.key}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium uppercase tracking-wide opacity-80">
                  {label}
                </span>
                <Icon className="w-4 h-4 opacity-70" aria-hidden />
              </div>
              <p className="text-2xl font-bold mt-2">{card.value}</p>
              <p className="text-xs mt-1 opacity-75">{hint}</p>
              {!disabled && (
                <p className="text-xs mt-2 font-medium text-indigo-700">View list →</p>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function GovernanceOverviewHeader({ total }: { total: number }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900">Oracle governance overview</h2>
      <p className="text-xs text-gray-500 mt-0.5">
        {total} Oracle-linked supplier{total === 1 ? '' : 's'} under external workforce governance · tiles open
        filtered views
      </p>
    </div>
  );
}
