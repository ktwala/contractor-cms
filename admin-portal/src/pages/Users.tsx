import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Section, ui } from '../ui/layout';
import { ScopeLegendCard } from '../components/ScopeLegendCard';
import { ForbiddenEmptyState, UnavailableEmptyState, EmptyListState } from '../ui/empty-states';

type UserRow = { id: string; email: string; display_name?: string; status?: string };

export default function Users() {
  const { canAny } = useAccess();
  const [q, setQ] = useState('');
  const [legalEntityId, setLegalEntityId] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<{ response?: { status?: number } } | null>(null);
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [legalEntities, setLegalEntities] = useState<{ id: string; name: string }[]>([]);

  const canManageUsers = canAny(['iam:users:manage']);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params: Record<string, string | number> = { q, limit: 50, offset: 0 };
      if (legalEntityId) params.legal_entity_id = legalEntityId;
      const res = await api.get('/api/enterprise/users', { params });
      setItems(res.data?.items ?? []);
      setTotal(res.data?.total ?? res.data?.items?.length ?? 0);
    } catch (e: unknown) {
      setErr(e as { response?: { status?: number } });
      setItems([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [q, legalEntityId]);

  useEffect(() => {
    if (!canManageUsers) return;
    fetchUsers();
  }, [canManageUsers, fetchUsers]);

  useEffect(() => {
    if (!canManageUsers) return;
    api
      .get('/legal-entities', { params: { limit: 200 } })
      .then((res) => setLegalEntities(res.data?.items ?? res.data ?? []))
      .catch(() => setLegalEntities([]));
  }, [canManageUsers]);

  if (!canManageUsers) {
    return (
      <Page title="Users" subtitle="Manage users and role assignments.">
        <ForbiddenEmptyState
          feature="Users"
          description="You need iam:users:manage to search users and assign roles."
        />
      </Page>
    );
  }

  const status = err?.response?.status ?? 0;
  if (status === 404 || status === 501) {
    return (
      <Page title="Users" subtitle="Manage users and role assignments.">
        <UnavailableEmptyState
          feature="Users"
          description="This tenant may not have user management enabled yet."
        />
      </Page>
    );
  }

  return (
    <Page
      title="Users"
      subtitle="Search users and manage role assignments (GLOBAL + per legal entity)."
      actions={
        <button type="button" disabled style={{ opacity: 0.6, padding: '10px 14px', borderRadius: 10, fontWeight: 700 }}        >
          Create User (Coming soon)
        </button>
      }
    >
      <Card>
        <CardHeader
          title="How assignment works"
          subtitle='Assignments are user-centric: e.g. "Give Kamo Payroll Clerk for LE-A." Roles are defined in Governance → Role Templates.'
        />
      </Card>

      <ScopeLegendCard />

      <Card>
        <CardHeader title="Search" subtitle="Search by email or name. Filter by legal entity." />
        <div style={{ display: 'flex', gap: ui.space.sm, padding: ui.space.lg, flexWrap: 'wrap' }}>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsers()}
            placeholder="Search users…"
            style={{
              flex: 1,
              minWidth: 200,
              padding: 10,
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: 14,
            }}
          />
          <select
            value={legalEntityId}
            onChange={(e) => setLegalEntityId(e.target.value)}
            style={{
              padding: '10px 14px',
              borderRadius: 10,
              border: '1px solid rgba(0,0,0,0.12)',
              fontSize: 14,
              minWidth: 180,
            }}
          >
            <option value="">All legal entities</option>
            {legalEntities.map((le) => (
              <option key={le.id} value={le.id}>
                {le.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => fetchUsers()}
            disabled={loading}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid rgba(79,70,229,0.3)',
              background: 'rgba(79,70,229,0.08)',
              color: 'rgba(79,70,229,0.95)',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </Card>

      <Section title="Users list" subtitle={loading ? 'Loading…' : `${total} users`}>
        <Card>
          {err && status !== 403 && status !== 404 && status !== 501 && (
            <div style={{ padding: ui.space.lg }}>
              <div
                style={{
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(239,68,68,0.12)',
                  color: 'rgba(185,28,28,0.95)',
                  fontSize: 13,
                }}
              >
                Failed to load users. Please retry.
              </div>
              <button
                type="button"
                onClick={() => fetchUsers()}
                style={{ marginTop: 12, padding: '8px 14px', borderRadius: 8, fontWeight: 700 }}
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !err && items.length === 0 && (
            <EmptyListState title="No users found" description="Try a different search term." />
          )}

          {items.length > 0 && (
            <div style={{ padding: ui.space.lg }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', opacity: 0.7 }}>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 800 }}>Email</th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 800 }}>Name</th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 800 }}>Status</th>
                    <th style={{ padding: '10px 8px', fontSize: 12, fontWeight: 800 }} />
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id} style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
                      <td style={{ padding: '12px 8px', fontSize: 13 }}>{u.email}</td>
                      <td style={{ padding: '12px 8px', fontSize: 13 }}>{u.display_name ?? '—'}</td>
                      <td style={{ padding: '12px 8px', fontSize: 13 }}>{u.status ?? '—'}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <Link
                          to={`/enterprise/users/${u.id}`}
                          style={{
                            color: 'rgba(79,70,229,0.95)',
                            fontWeight: 700,
                            fontSize: 13,
                            textDecoration: 'none',
                          }}
                        >
                          Manage
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </Section>
    </Page>
  );
}
