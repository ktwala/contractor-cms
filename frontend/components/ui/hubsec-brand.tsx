import { Shield } from 'lucide-react';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';

/** Hubsec Workforce–aligned sidebar brand mark (PR-UI-TOKENS-2). */
export function HubsecBrand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3 min-w-0" data-testid="hubsec-brand">
      <div
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand shadow-md shadow-primary-600/30"
        aria-hidden
      >
        <Shield className="h-5 w-5 text-white" strokeWidth={2.25} />
      </div>
      {!compact && <span className="sidebar-brand truncate">{EXTERNAL_WORKFORCE_LABELS.product}</span>}
    </div>
  );
}
