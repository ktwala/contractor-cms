import { useEffect } from 'react';

/** Broadcast when Operational Trust is granted, suspended, restored, or denied. */
export const OPERATIONAL_TRUST_CHANGED_EVENT = 'ewp:operational-trust-changed';

export type SupplierTrustStatus =
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'DRAFT'
  | 'OFFBOARDED'
  | 'ARCHIVED'
  | 'TERMINATED';

export type OperationalTrustTransitionKind =
  | 'GRANTED'
  | 'RESTORED'
  | 'SUSPENDED'
  | 'DENIED';

export type OperationalTrustChangedDetail = {
  supplierId: string;
  previousState: SupplierTrustStatus;
  currentState: SupplierTrustStatus;
  transitionKind: OperationalTrustTransitionKind;
  changedBy?: string;
  changedAt: string;
  reason?: string;
};

export function resolveOperationalTrustTransitionKind(
  previousState: string,
  currentState: string,
): OperationalTrustTransitionKind {
  if (currentState === 'ACTIVE') {
    return previousState === 'SUSPENDED' ? 'RESTORED' : 'GRANTED';
  }
  if (currentState === 'SUSPENDED') {
    return previousState === 'PENDING_APPROVAL' ? 'DENIED' : 'SUSPENDED';
  }
  return 'SUSPENDED';
}

export function formatOperationalTrustChangedBy(input: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
} | null): string | undefined {
  if (!input) return undefined;
  const name = [input.firstName, input.lastName].filter(Boolean).join(' ').trim();
  return name || input.email || undefined;
}

export function buildOperationalTrustChangedDetail(input: {
  supplierId: string;
  previousState: string;
  currentState: string;
  reason?: string;
  changedBy?: string;
  changedAt?: string;
}): OperationalTrustChangedDetail {
  const previousState = input.previousState as SupplierTrustStatus;
  const currentState = input.currentState as SupplierTrustStatus;
  return {
    supplierId: input.supplierId,
    previousState,
    currentState,
    transitionKind: resolveOperationalTrustTransitionKind(previousState, currentState),
    changedBy: input.changedBy,
    changedAt: input.changedAt ?? new Date().toISOString(),
    reason: input.reason,
  };
}

export function dispatchOperationalTrustChanged(detail: OperationalTrustChangedDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OperationalTrustChangedDetail>(OPERATIONAL_TRUST_CHANGED_EVENT, { detail }),
  );
}

export function useOperationalTrustChanged(
  onChange: (detail: OperationalTrustChangedDetail) => void,
): void {
  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<OperationalTrustChangedDetail>;
      if (custom.detail?.supplierId) {
        onChange(custom.detail);
      }
    };
    window.addEventListener(OPERATIONAL_TRUST_CHANGED_EVENT, handler);
    return () => window.removeEventListener(OPERATIONAL_TRUST_CHANGED_EVENT, handler);
  }, [onChange]);
}
