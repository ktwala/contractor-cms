import React from 'react';
import { Page, Card, CardHeader, EmptyState, ui } from './layout';
import { ForbiddenEmptyState, UnavailableEmptyState } from './empty-states';
import * as styles from '../styles/common';

type ApiError = {
  status?: number;
  message?: string;
};

export function normalizeError(err: unknown): ApiError {
  const e = err as {
    response?: { status?: number; data?: { message?: string; error?: string } };
    status?: number;
    message?: string;
    code?: string;
  };
  const status = e?.response?.status ?? e?.status;
  let message =
    e?.response?.data?.message ??
    e?.response?.data?.error ??
    e?.message ??
    'Unknown error';
  // Helpful message when backend is unreachable (connection refused, CORS, etc.)
  if (
    e?.code === 'ERR_NETWORK' ||
    (typeof message === 'string' && (message === 'Network Error' || message.includes('network') || message.includes('ECONNREFUSED')))
  ) {
    message =
      'Cannot reach the API. Ensure the backend is running (npm run start:dev in project root). If using Docker, set VITE_PROXY_TARGET=http://localhost:4000 in admin-portal/.env.';
  }
  return { status, message };
}

export default function ExamplePageTemplate() {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<ApiError | null>(null);

  // Example: data
  const [items, setItems] = React.useState<unknown[]>([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      // TODO: call API
      // const res = await api.get('/something');
      // setItems(res.data.items ?? []);
      setItems([]);
    } catch (e: unknown) {
      setError(normalizeError(e));
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void load();
  }, []);

  const canRetry = !loading;

  // Example: consistent RBAC / availability handling
  if (error?.status === 403) {
    return (
      <Page title="Example Feature" subtitle="You don't have access to this feature.">
        <ForbiddenEmptyState feature="Example Feature" />
      </Page>
    );
  }

  if (error?.status === 404 || error?.status === 501) {
    return (
      <Page title="Example Feature" subtitle="This feature is not available for this tenant.">
        <UnavailableEmptyState feature="Example Feature" />
      </Page>
    );
  }

  if (error && error.status && error.status >= 500) {
    return (
      <Page
        title="Example Feature"
        subtitle="Something went wrong while loading this page."
        actions={
          <button
            onClick={() => void load()}
            disabled={!canRetry}
            style={{
              ...styles.buttonPrimary,
              opacity: canRetry ? 1 : 0.6,
              cursor: canRetry ? 'pointer' : 'not-allowed',
            }}
          >
            Retry
          </button>
        }
      >
        <EmptyState title="Failed to load" description={error.message} />
      </Page>
    );
  }

  return (
    <Page
      title="Example Feature"
      subtitle="Short explanation of what this page does."
      actions={
        <button style={styles.buttonPrimary} onClick={() => alert('Primary action')} type="button">
          Primary action
        </button>
      }
    >
      <Card>
        <CardHeader title="Section" subtitle={loading ? 'Loading…' : `Showing ${items.length}`} />
        <div style={{ marginTop: ui.space.md }}>
          {/* TODO: page content */}
          <div style={{ color: styles.colors.textSecondary, fontSize: 13 }}>
            Replace this with real content.
          </div>
        </div>
      </Card>
    </Page>
  );
}
