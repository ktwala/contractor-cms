import { useState, useCallback } from 'react';

interface DrilldownState {
  open: boolean;
  issueType?: string;
  entityType?: string;
  legalEntityId?: string;
  orgUnitId?: string;
  title?: string;
  groupBy?: 'legalEntity' | 'orgUnit' | 'issueType';
}

export function useIssueDrilldown() {
  const [state, setState] = useState<DrilldownState>({ open: false });

  const openDrilldown = useCallback((opts: Omit<DrilldownState, 'open'>) => {
    setState({ open: true, ...opts });
  }, []);

  const closeDrilldown = useCallback(() => {
    setState({ open: false });
  }, []);

  return { drilldownState: state, openDrilldown, closeDrilldown };
}
