'use client';

import type { ReactNode } from 'react';
import { BarChart3 } from 'lucide-react';

type ChartPanelProps = {
  title: ReactNode;
  icon?: ReactNode;
  heightClassName?: string;
  hasData: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  children: ReactNode;
};

/** Chart card with Workforce-style empty state when series has no values (PR-UI-TOKENS-2). */
export function ChartPanel({
  title,
  icon,
  heightClassName = 'h-64',
  hasData,
  emptyTitle = 'No data yet',
  emptyDescription = 'This chart will populate once there is activity to report.',
  children,
}: ChartPanelProps) {
  return (
    <div className="card">
      <h3 className="text-lg font-medium text-content mb-4 flex items-center">
        {icon}
        {title}
      </h3>
      <div className={heightClassName}>
        {hasData ? (
          children
        ) : (
          <div className="chart-empty-state h-full" data-testid="chart-empty-state">
            <BarChart3 className="w-10 h-10 text-slate-400" strokeWidth={1.5} />
            <p className="text-sm font-medium text-content-muted mt-3">{emptyTitle}</p>
            <p className="text-xs text-slate-500 mt-1 max-w-xs text-center">
              {emptyDescription}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function hasNumericSeriesData(items: Array<{ value?: number | null }>): boolean {
  return items.some((item) => (item.value ?? 0) > 0);
}

export { hasNumericSeriesData };
