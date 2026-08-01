/**
 * DATA_PAGE_TEMPLATE.tsx — Canonical reference implementation
 *
 * Copy this file when creating a new data-backed page and adapt it to your
 * module.  It demonstrates the full page-state contract:
 *
 *   loading  → spinner
 *   error    → red card + retry
 *   blocked  → setup / permission guidance + CTA
 *   empty    → neutral message + optional action
 *   ready    → full data view
 *
 * See /docs/PAGE_STATE_CONTRACT.md for the full specification.
 */

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../src/services/api';
import * as styles from '../../src/styles/common';
import { Page, Card, Banner } from '../../src/ui/layout';
import { classifyPageState } from '../../src/utils/pageState';
import { PageStateView } from '../../src/ui/PageStateViews';
import { usePageStateTelemetry } from '../../src/utils/pageStateTelemetry';

// ─── Types ───────────────────────────────────────────────────────

interface MyItem {
  id: string;
  name: string;
  status: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────

const PAGE_KEY = 'myModule.items';
const MODULE_KEY = 'myModule';

// ─── Component ───────────────────────────────────────────────────

export default function MyItemsPage() {
  const navigate = useNavigate();

  // Load state — drives the page-level rendering decision
  const [items, setItems] = useState<MyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<any>(null);

  // Action state — inline banner, never hides the page
  const [actionError, setActionError] = useState<string | null>(null);

  // ─── Data fetching ───────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const res = await api.get('/my-items');
      setItems(res.data?.items ?? res.data ?? []);
    } catch (err) {
      setLoadError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  // ─── Classification ──────────────────────────────────────────

  const pageState = classifyPageState({ loading, error: loadError, data: items });

  // Telemetry: fires once per state transition (deduped internally)
  usePageStateTelemetry(PAGE_KEY, MODULE_KEY, pageState);

  // ─── Action handler example ──────────────────────────────────

  const handleDelete = async (id: string) => {
    try {
      setActionError(null);
      await api.delete(`/my-items/${id}`);
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch (err: any) {
      setActionError(err?.response?.data?.message ?? 'Failed to delete item');
    }
  };

  // ─── Render ──────────────────────────────────────────────────

  return (
    <Page
      title="My Items"
      subtitle="Manage items for this module."
      actions={
        <button style={styles.buttonPrimary} onClick={() => navigate('/my-items/new')}>
          Create Item
        </button>
      }
    >
      {/* Action error — inline, never replaces the page */}
      {actionError && (
        <Banner type="error" message={actionError} onDismiss={() => setActionError(null)} />
      )}

      {/* Page state rendering — covers loading, error, blocked, empty */}
      {pageState.kind === 'loading' ? (
        <div style={styles.loadingContainer}>
          <div style={styles.loadingSpinner} />
        </div>
      ) : pageState.kind !== 'ready' ? (
        <PageStateView
          state={pageState}
          onRetry={loadData}
          emptyTitle="No items found"
          emptyMessage="Create your first item to get started."
          page={PAGE_KEY}
          module={MODULE_KEY}
        />
      ) : (
        /* Ready state — full data view */
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeader}>
                  <th style={styles.tableHeaderCell}>Name</th>
                  <th style={styles.tableHeaderCell}>Status</th>
                  <th style={styles.tableHeaderCell}>Updated</th>
                  <th style={styles.tableHeaderCell}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} style={styles.tableRow}>
                    <td style={styles.tableCell}>{item.name}</td>
                    <td style={styles.tableCell}>{item.status}</td>
                    <td style={styles.tableCell}>{new Date(item.updatedAt).toLocaleDateString()}</td>
                    <td style={styles.tableCell}>
                      <button style={styles.buttonSecondary} onClick={() => handleDelete(item.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </Page>
  );
}
