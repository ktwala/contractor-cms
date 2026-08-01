'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import { CalendarCheck, CalendarX, CheckCircle, GitBranch, Loader2, TriangleAlert } from 'lucide-react';

type GovernancePhase = 'NO_CUTOVER' | 'PRE_CUTOVER' | 'POST_CUTOVER';

type CutoverState = {
  workforceMigrationCutoverAt: string | null;
  updatedAt: string;
  governancePhase: GovernancePhase;
};

/**
 * Derive the ISO date-input value (YYYY-MM-DD) from an ISO timestamp.
 * Returns empty string when null.
 */
function toDateInputValue(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

/**
 * Convert a date-input value (YYYY-MM-DD) to midnight UTC ISO string.
 */
function toIsoString(dateValue: string): string {
  return new Date(`${dateValue}T00:00:00.000Z`).toISOString();
}

const PHASE_BANNER: Record<GovernancePhase, { text: string; classes: string }> = {
  NO_CUTOVER: {
    text: 'Bootstrap lineage visible — workforce cutover not declared',
    classes: 'border-violet-200 bg-violet-50 text-violet-800',
  },
  PRE_CUTOVER: {
    text: 'Pre-cutover — bootstrap governance remains active until cutover date',
    classes: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  POST_CUTOVER: {
    text: 'Post-cutover — operational governance prioritized; bootstrap lineage hidden by default',
    classes: 'border-indigo-200 bg-indigo-50 text-indigo-800',
  },
};

const PHASE_BADGE: Record<GovernancePhase, { label: string; classes: string }> = {
  NO_CUTOVER: { label: 'No cutover', classes: 'bg-violet-100 text-violet-700 border-violet-300' },
  PRE_CUTOVER: { label: 'Pre-cutover', classes: 'bg-amber-100 text-amber-800 border-amber-300' },
  POST_CUTOVER: { label: 'Post-cutover', classes: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
};

type WorkforceCutoverPanelProps = {
  canManage: boolean;
  onCutoverChanged?: () => void;
};

export default function WorkforceCutoverPanel({
  canManage,
  onCutoverChanged,
}: WorkforceCutoverPanelProps) {
  const [state, setState] = useState<CutoverState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dateInput, setDateInput] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getWorkforceCutover();
      setState(data);
      setDateInput(toDateInputValue(data.workforceMigrationCutoverAt));
    } catch {
      setError('Could not load cutover state');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!canManage) return;
    load();
  }, [load, canManage]);

  const handleSubmit = async () => {
    if (!dateInput) return;
    setError('');
    setSaving(true);
    try {
      const result = await api.setWorkforceCutover(toIsoString(dateInput));
      setState(result);
      setDateInput(toDateInputValue(result.workforceMigrationCutoverAt));
      onCutoverChanged?.();
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        'Failed to set cutover date — check invariants and try again.';
      setError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    // For POST_CUTOVER, always require confirmation before clearing.
    // Clearing an active cutover reopens migration-era governance visibility —
    // this is operationally disruptive and must not happen accidentally.
    if (state?.governancePhase === 'POST_CUTOVER' && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);
    setError('');
    setSaving(true);
    try {
      const result = await api.setWorkforceCutover(null);
      setState(result);
      setDateInput('');
      onCutoverChanged?.();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Failed to clear cutover.';
      setError(Array.isArray(msg) ? msg.join(' ') : String(msg));
    } finally {
      setSaving(false);
    }
  };

  // Panel is entirely hidden for read-only users — they see the banner in
  // HcmConnectorOperationsPanel only.
  if (!canManage) return null;

  if (loading) {
    return (
      <div
        className="rounded-lg border bg-white p-5 flex items-center gap-2 text-sm text-gray-500"
        data-testid="cutover-panel"
      >
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading cutover state…
      </div>
    );
  }

  const phase = state?.governancePhase ?? 'NO_CUTOVER';
  const banner = PHASE_BANNER[phase];
  const badge = PHASE_BADGE[phase];
  const hasActiveCutover = !!state?.workforceMigrationCutoverAt;

  return (
    <div
      className="rounded-lg border bg-white shadow-sm overflow-hidden"
      data-testid="cutover-panel"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b">
        <div className="flex items-center gap-2">
          <CalendarCheck className="w-4 h-4 text-violet-600" aria-hidden />
          <h2 className="text-sm font-semibold text-gray-900">
            Workforce cutover ceremony
          </h2>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badge.classes}`}
          data-testid="cutover-phase-badge"
        >
          <GitBranch className="w-3 h-3" aria-hidden />
          {badge.label}
        </span>
      </div>

      {/* Governance phase banner */}
      <div className={`px-5 py-3 text-sm font-medium border-b ${banner.classes}`}>
        {banner.text}
      </div>

      <div className="px-5 py-4 space-y-4">
        <p className="text-xs text-gray-500 leading-relaxed">
          Declaring cutover signals that {EXTERNAL_WORKFORCE_LABELS.productShort} has taken over as the operational authority for
          external workforce governance. After cutover, import-era lineage is hidden by default —
          it remains as audit evidence and is accessible via "Show migration lineage".
          Cutover cannot be declared before the first successful HCM import and requires
          at least one materialized contractor.
        </p>

        {/* Current date display */}
        {hasActiveCutover && (
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <CheckCircle className="w-4 h-4 text-indigo-500 shrink-0" aria-hidden />
            <span>
              Cutover declared:{' '}
              <strong>
                {new Date(state!.workforceMigrationCutoverAt!).toLocaleDateString(undefined, {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </strong>
            </span>
            {phase === 'POST_CUTOVER' && (
              <span className="ml-1 inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-xs text-indigo-700">
                <TriangleAlert className="w-3 h-3" aria-hidden />
                Active — operational governance in effect
              </span>
            )}
          </div>
        )}

        {/* Date input + actions */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="cutover-date-input"
              className="text-xs font-medium text-gray-700"
            >
              {hasActiveCutover ? 'Change cutover date' : 'Set cutover date'}
            </label>
            <input
              id="cutover-date-input"
              type="date"
              value={dateInput}
              onChange={(e) => setDateInput(e.target.value)}
              disabled={saving}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50"
              data-testid="cutover-date-input"
            />
          </div>
          <button
            type="button"
            id="cutover-submit-btn"
            onClick={handleSubmit}
            disabled={saving || !dateInput}
            className="inline-flex items-center gap-2 rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-violet-700 disabled:opacity-50 transition-colors"
            data-testid="cutover-submit-btn"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <CalendarCheck className="w-4 h-4" aria-hidden />
            )}
            {hasActiveCutover ? 'Update cutover' : 'Declare cutover'}
          </button>

          {hasActiveCutover && (
            <button
              type="button"
              id="cutover-clear-btn"
              onClick={handleClear}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 transition-colors"
              data-testid="cutover-clear-btn"
            >
              <CalendarX className="w-4 h-4" aria-hidden />
              Clear cutover
            </button>
          )}
        </div>

        {/* Error */}
        {error && (
          <p
            className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
            role="alert"
            data-testid="cutover-error"
          >
            {error}
          </p>
        )}

        {/* Confirmation dialog — POST_CUTOVER clear only */}
        {showConfirm && (
          <div
            className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3"
            role="dialog"
            aria-modal="false"
            aria-labelledby="confirm-dialog-title"
            data-testid="cutover-confirm-dialog"
          >
            <p
              id="confirm-dialog-title"
              className="text-sm font-semibold text-amber-900 flex items-center gap-2"
            >
              <TriangleAlert className="w-4 h-4 shrink-0" aria-hidden />
              Confirm cutover clear
            </p>
            <p className="text-sm text-amber-800">
              Clearing an active cutover restores bootstrap lineage as the default visible
              view. This reopens migration-era governance visibility. Operational governance
              will no longer be the default — bootstrap signals will resurface in the
              governance scan. Confirm to proceed.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleClear}
                disabled={saving}
                className="rounded-md bg-amber-700 px-4 py-1.5 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {saving ? 'Clearing…' : 'Yes, clear cutover'}
              </button>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="rounded-md border border-amber-300 bg-white px-4 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
