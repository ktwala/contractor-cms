'use client';

import {
  EvidenceChecklistResult,
  evidenceStatusClass,
  jurisdictionLabel,
} from '@/lib/supplier-evidence';
import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';

type SupplierEvidenceChecklistProps = {
  checklist: EvidenceChecklistResult | null;
  loading?: boolean;
  compact?: boolean;
};

export default function SupplierEvidenceChecklist({
  checklist,
  loading = false,
  compact = false,
}: SupplierEvidenceChecklistProps) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading onboarding checklist…</p>;
  }

  if (!checklist) {
    return null;
  }

  const Icon = checklist.complete ? CheckCircle2 : AlertCircle;
  const bannerTone = checklist.complete
    ? 'text-green-700 bg-green-50 border-green-200'
    : 'text-amber-800 bg-amber-50 border-amber-200';

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${bannerTone}`}>
        <Icon className="w-5 h-5 shrink-0" />
        <div>
          <p className="font-medium">
            {checklist.complete
              ? 'Onboarding evidence complete'
              : 'Onboarding evidence incomplete'}
          </p>
          <p className="text-xs opacity-80 mt-0.5">
            Jurisdiction: {jurisdictionLabel(checklist.jurisdictionCode)} ({checklist.jurisdictionCode})
          </p>
          {!checklist.complete && (
            <p className="text-sm opacity-90">
              {checklist.missingCount > 0 && `${checklist.missingCount} missing`}
              {checklist.missingCount > 0 && checklist.expiredCount > 0 && ' · '}
              {checklist.expiredCount > 0 && `${checklist.expiredCount} expired`}
              {' — approval to Active is blocked until resolved.'}
            </p>
          )}
        </div>
      </div>

      <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
        {checklist.items.map((item) => (
          <li
            key={item.type}
            className={`flex items-start justify-between gap-4 px-4 py-3 ${compact ? 'text-sm' : ''}`}
          >
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
              {item.fileName && (
                <p className="text-xs text-gray-600 mt-1 truncate">
                  File: {item.fileName}
                  {item.expiryDate && (
                    <span className="inline-flex items-center gap-1 ml-2 text-gray-500">
                      <Clock className="w-3 h-3" />
                      Expires {new Date(item.expiryDate).toLocaleDateString()}
                    </span>
                  )}
                </p>
              )}
            </div>
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${evidenceStatusClass(item.status)}`}
            >
              {item.status === 'PRESENT'
                ? 'Complete'
                : item.status === 'EXPIRED'
                  ? 'Expired'
                  : 'Missing'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
