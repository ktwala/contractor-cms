'use client';

import {
  WorkforceHistoryEntry,
  formatWorkforceHistorySource,
} from '@/lib/contractor-workforce-review';
import { formatWorkforceState } from '@/lib/workforce-state';
import { safeFormatDate } from '@/lib/safe-string';

type ContractorWorkforceTimelineProps = {
  entries: WorkforceHistoryEntry[];
  loading?: boolean;
  emptyMessage?: string;
  showSource?: boolean;
  showReason?: boolean;
};

export default function ContractorWorkforceTimeline({
  entries,
  loading = false,
  emptyMessage = 'No workforce history recorded yet.',
  showSource = true,
  showReason = true,
}: ContractorWorkforceTimelineProps) {
  if (loading) {
    return <p className="text-xs text-gray-500">Loading workforce timeline…</p>;
  }

  if (entries.length === 0) {
    return <p className="text-xs text-gray-500">{emptyMessage}</p>;
  }

  return (
    <ol className="space-y-3 border-l-2 border-gray-200 ml-2 pl-4">
      {entries.map((entry) => (
        <li key={entry.id} className="text-xs">
          <div className="font-medium text-gray-900">{entry.transitionLabel}</div>
          <div className="text-gray-500 mt-0.5">
            {entry.fromState
              ? `${formatWorkforceState(entry.fromState)} → ${formatWorkforceState(entry.toState)}`
              : formatWorkforceState(entry.toState)}
          </div>
          <div className="text-gray-500">{safeFormatDate(entry.occurredAt)}</div>
          {entry.effectiveAt && (
            <div className="text-gray-600">Effective: {safeFormatDate(entry.effectiveAt)}</div>
          )}
          {showReason && entry.reason && (
            <div className="text-gray-600">Reason: {entry.reason}</div>
          )}
          {showSource && (
            <div className="text-gray-500">Source: {formatWorkforceHistorySource(entry.source)}</div>
          )}
        </li>
      ))}
    </ol>
  );
}
