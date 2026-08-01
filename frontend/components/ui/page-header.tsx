'use client';

import { RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from './button';

type Props = {
  title: string;
  description?: string;
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  actions?: ReactNode;
};

/** Standard page title block with optional toolbar refresh. */
export function PageHeader({ title, description, onRefresh, refreshing, actions }: Props) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 space-y-1">
        <h1 className="page-heading">{title}</h1>
        {description ? <p className="page-subheading max-w-3xl">{description}</p> : null}
      </div>
      {(actions || onRefresh) && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          {onRefresh ? (
            <Button
              variant="toolbar"
              onClick={onRefresh}
              loading={refreshing}
              icon={
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              }
              data-testid="page-refresh"
            >
              Refresh
            </Button>
          ) : null}
        </div>
      )}
    </header>
  );
}
