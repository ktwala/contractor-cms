import { useEffect, useCallback, useState } from 'react';

export function useUnsavedChanges(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const confirmNavigation = useCallback(
    (cb: () => void) => {
      if (!dirty || window.confirm('You have unsaved changes. Discard and leave?')) {
        cb();
      }
    },
    [dirty],
  );

  return { confirmNavigation };
}

export function useDirtyTracking<T>(initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [dirty, setDirty] = useState(false);

  const update = useCallback((next: T | ((prev: T) => T)) => {
    setValue(next);
    setDirty(true);
  }, []);

  const reset = useCallback((next: T) => {
    setValue(next);
    setDirty(false);
  }, []);

  return { value, dirty, update, reset };
}
