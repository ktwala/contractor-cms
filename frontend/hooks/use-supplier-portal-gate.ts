'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { SUPPLIER_NOT_LINKED_MESSAGE } from '@/lib/supplier-portal-context';

/**
 * Ensures profile is hydrated with supplierId before portal API calls (PR-CMS-RUNTIME-HARDENING-1).
 */
export function useSupplierPortalGate() {
  const { user, loading: authLoading, refreshProfile } = useAuth();
  const [hydrating, setHydrating] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await refreshProfile();
      } finally {
        if (!cancelled) setHydrating(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshProfile]);

  const supplierLinked = Boolean(user?.supplierId);
  const blockedMessage = supplierLinked ? null : SUPPLIER_NOT_LINKED_MESSAGE;

  const guardApiCall = useCallback(
    (canProceed: boolean) => canProceed && supplierLinked,
    [supplierLinked],
  );

  return {
    authLoading,
    hydrating,
    supplierLinked,
    supplierId: user?.supplierId ?? null,
    blockedMessage,
    guardApiCall,
    ready: !authLoading && !hydrating,
  };
}
