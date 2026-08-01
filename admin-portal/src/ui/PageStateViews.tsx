import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as styles from '../styles/common';
import { Card } from './layout';
import { getBlockedInfo } from '../utils/pageState';
import type { PageState, BlockedCodeInfo } from '../utils/pageState';
import {
  trackPageStateRendered,
  trackPageStateRetryClicked,
  trackPageStateCtaClicked,
  usePageStateTelemetry,
} from '../utils/pageStateTelemetry';

/**
 * Renders the appropriate state view based on the classified page state.
 * Returns null for 'ready' (caller renders data) and 'loading' (caller renders skeleton).
 *
 * Pass `page` and `module` to enable automatic page-state telemetry.
 */
export function PageStateView({ state, emptyTitle, emptyMessage, emptyAction, onRetry, page, module: mod }: {
  state: PageState;
  emptyTitle?: string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  onRetry?: () => void;
  page?: string;
  module?: string;
}) {
  usePageStateTelemetry(page ?? 'unknown', mod ?? 'unknown', state);

  switch (state.kind) {
    case 'loading':
    case 'ready':
      return null;
    case 'error':
      return (
        <PageErrorView
          message={state.message}
          retryable={state.retryable}
          onRetry={onRetry}
          page={page}
          module={mod}
          errorCode={state.code}
          httpStatus={state.status}
        />
      );
    case 'blocked':
      return <PageBlockedView code={state.code} message={state.message} page={page} module={mod} />;
    case 'empty':
      return <PageEmptyView title={emptyTitle} message={emptyMessage} action={emptyAction} page={page} module={mod} />;
  }
}

export function PageErrorView({ message, retryable, onRetry, page, module: mod, errorCode, httpStatus }: {
  message: string;
  retryable: boolean;
  onRetry?: () => void;
  page?: string;
  module?: string;
  errorCode?: string;
  httpStatus?: number;
}) {
  const handleRetry = onRetry
    ? () => {
        trackPageStateRetryClicked({
          page: page ?? 'unknown',
          module: mod ?? 'unknown',
          errorCode,
          httpStatus,
        });
        onRetry();
      }
    : undefined;

  return (
    <Card>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>&#x26A0;&#xFE0F;</div>
        <p style={{ fontWeight: 600, fontSize: 16, color: '#991b1b', margin: '0 0 8px' }}>
          Something went wrong
        </p>
        <p style={{ color: styles.colors.textMuted, margin: '0 0 16px', maxWidth: 440, marginInline: 'auto', fontSize: 13 }}>
          {message}
        </p>
        {retryable && handleRetry && (
          <button style={styles.buttonSecondary} onClick={handleRetry}>
            Retry
          </button>
        )}
      </div>
    </Card>
  );
}

const ICON_MAP: Record<NonNullable<BlockedCodeInfo['icon']>, { html: string; title: string }> = {
  setup:       { html: '&#x1F3E2;', title: 'Setup required' },
  lock:        { html: '&#x1F512;', title: 'Access restricted' },
  unavailable: { html: '&#x1F6AB;', title: 'Not available' },
};

export function PageBlockedView({ code, message, page, module: mod }: {
  code: string;
  message: string;
  page?: string;
  module?: string;
}) {
  const navigate = useNavigate();
  const [showHelp, setShowHelp] = useState(false);
  const info = getBlockedInfo(code);
  const displayMessage = info?.message ?? message;
  const cta = info?.cta;
  const helpText = info?.helpText;
  const iconKey = info?.icon ?? 'setup';
  const { html, title } = ICON_MAP[iconKey];

  const handleCta = cta
    ? () => {
        trackPageStateCtaClicked({
          page: page ?? 'unknown',
          module: mod ?? 'unknown',
          state: 'blocked',
          code,
          ctaTarget: cta.path,
          ctaLabel: cta.label,
        });
        navigate(cta.path);
      }
    : undefined;

  return (
    <Card>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }} dangerouslySetInnerHTML={{ __html: html }} />
        <p style={{ fontWeight: 600, fontSize: 16, color: styles.colors.textPrimary, margin: '0 0 8px' }}>
          {title}
        </p>
        <p style={{ color: styles.colors.textMuted, margin: '0 0 16px', maxWidth: 440, marginInline: 'auto', fontSize: 13 }}>
          {displayMessage}
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap' }}>
          {handleCta && (
            <button style={styles.buttonPrimary} onClick={handleCta}>
              {cta!.label}
            </button>
          )}
          {helpText && (
            <button
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: styles.colors.primary, fontSize: 13, padding: '8px 4px',
                textDecoration: 'none',
              }}
              onClick={() => setShowHelp((v) => !v)}
            >
              {showHelp ? 'Hide details' : 'Why is this required?'}
            </button>
          )}
        </div>
        {showHelp && helpText && (
          <div style={{
            marginTop: 16, padding: '12px 16px', borderRadius: 8,
            background: '#f8fafc', border: '1px solid #e2e8f0',
            maxWidth: 480, marginInline: 'auto', textAlign: 'left',
          }}>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: styles.colors.textSecondary }}>
              {helpText}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

export function PageEmptyView({ title, message, action, page, module: mod }: {
  title?: string;
  message?: string;
  action?: React.ReactNode;
  page?: string;
  module?: string;
}) {
  return (
    <Card>
      <div style={{ padding: 40, textAlign: 'center' }}>
        <p style={{ color: styles.colors.textMuted, margin: '0 0 16px' }}>
          {title ?? message ?? 'No data found'}
        </p>
        {action}
      </div>
    </Card>
  );
}
