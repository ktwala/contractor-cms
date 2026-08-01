'use client';

import { WORKFORCE_IMPORT_TABS } from '@/lib/external-workforce-labels';
import type { WorkforceImportTabId } from './types';

type Props = {
  activeTab: WorkforceImportTabId;
  onTabChange: (tab: WorkforceImportTabId) => void;
};

const TAB_ORDER: WorkforceImportTabId[] = [
  'overview',
  'history',
  'governance',
  'reconciliation',
  'cutover',
];

export function WorkforceImportTabNav({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="border-b border-gray-200"
      aria-label="Workforce import sections"
      data-testid="workforce-import-tabs"
    >
      <div className="flex flex-wrap gap-1 -mb-px">
        {TAB_ORDER.map((tabId) => {
          const isActive = activeTab === tabId;
          return (
            <button
              key={tabId}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tabId)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid={`workforce-import-tab-${tabId}`}
            >
              {WORKFORCE_IMPORT_TABS[tabId]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
