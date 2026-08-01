'use client';

import { SUPPLIER_SYNC_TABS } from '@/lib/supplier-synchronization-labels';
import type { SupplierSyncTabId } from './types';

type Props = {
  activeTab: SupplierSyncTabId;
  onTabChange: (tab: SupplierSyncTabId) => void;
};

const TAB_ORDER: SupplierSyncTabId[] = ['overview', 'history', 'governance'];

export function SupplierSyncTabNav({ activeTab, onTabChange }: Props) {
  return (
    <nav
      className="border-b border-gray-200"
      aria-label="Supplier synchronization sections"
      data-testid="supplier-sync-tabs"
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
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              data-testid={`supplier-sync-tab-${tabId}`}
            >
              {SUPPLIER_SYNC_TABS[tabId]}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
