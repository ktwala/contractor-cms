import { useState, useCallback, useRef } from 'react';

interface DeltaEntry {
  label: string;
  before: number;
  after: number;
}

export function useReadinessDelta() {
  const [deltas, setDeltas] = useState<DeltaEntry[]>([]);
  const [visible, setVisible] = useState(false);
  const snapshotRef = useRef<Record<string, number>>({});

  const captureSnapshot = useCallback((values: Record<string, number>) => {
    snapshotRef.current = { ...values };
  }, []);

  const compareAndShow = useCallback((
    currentValues: Record<string, number>,
    labels: Record<string, string>,
  ) => {
    const entries: DeltaEntry[] = [];
    for (const [key, after] of Object.entries(currentValues)) {
      const before = snapshotRef.current[key];
      if (before !== undefined && before !== after) {
        entries.push({ label: labels[key] || key, before, after });
      }
    }
    if (entries.length > 0) {
      setDeltas(entries);
      setVisible(true);
    }
  }, []);

  const dismiss = useCallback(() => setVisible(false), []);

  return { deltas, visible, captureSnapshot, compareAndShow, dismiss };
}
