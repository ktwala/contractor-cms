'use client';

import { Component, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  children: ReactNode;
  tabLabel: string;
};

type State = {
  hasError: boolean;
  message: string;
};

/** Keeps one supplier-sync tab failure from taking down the whole operations page. */
export class SupplierSyncTabErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected render error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50/80 p-6"
          role="alert"
          data-testid="supplier-sync-tab-error"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Could not render {this.props.tabLabel}
              </p>
              <p className="text-sm text-amber-900 mt-1">
                Refresh the page or switch tabs. If the problem persists, check connector API
                responses for missing fields.
              </p>
              {this.state.message ? (
                <p className="text-xs font-mono text-amber-800 mt-2">{this.state.message}</p>
              ) : null}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
