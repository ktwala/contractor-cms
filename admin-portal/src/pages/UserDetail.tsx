import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';
import { useAccess } from '../hooks/useAccess';
import { Page, Card, CardHeader, Section, ui } from '../ui/layout';
import { ForbiddenEmptyState, UnavailableEmptyState } from '../ui/empty-states';
import { getAssignableRoles, type RoleScopeType, type PolicyCountry } from '../shared/rbacRolePolicy';

type UserDetail = { id: string; email: string; display_name: string; status: string };
type RoleAssignments = {
  global: { role: string }[];
  legal_entities: { legal_entity_id: string; legal_entity_name: string; roles: string[] }[];
};

type LegalEntityOption = { id: string; name: string; country?: string };

export default function UserDetail() {
  const { userId } = useParams<{ userId: string }>();
  const { canAny } = useAccess();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [assignments, setAssignments] = useState<RoleAssignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<{ response?: { status?: number } } | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ scope: 'LEGAL_ENTITY' as RoleScopeType, role: '', legal_entity_id: '' });
  const [roles, setRoles] = useState<{ name: string }[]>([]);
  const [legalEntities, setLegalEntities] = useState<LegalEntityOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [removeConfirm, setRemoveConfirm] = useState<{
    role: string;
    scope: 'GLOBAL' | 'LEGAL_ENTITY';
    legalEntityId?: string;
    legalEntityName?: string;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const canManageUsers = canAny(['iam:users:manage']);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const load = useCallback(async () => {
    if (!userId || !canManageUsers) return;
    setLoading(true);
    setErr(null);
    try {
      const [userRes, assignRes] = await Promise.all([
        api.get(`/api/enterprise/users/${userId}`),
        api.get(`/api/enterprise/users/${userId}/role-assignments`),
      ]);
      setUser(userRes.data);
      setAssignments(assignRes.data);
    } catch (e: unknown) {
      setErr(e as { response?: { status?: number } });
      setUser(null);
      setAssignments(null);
    } finally {
      setLoading(false);
    }
  }, [userId, canManageUsers]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!canManageUsers) return;
    api.get('/api/enterprise/roles/templates').then((r) => setRoles(r.data ?? []));
    api
      .get('/legal-entities', { params: { limit: 200 } })
      .then((r) => setLegalEntities(r.data?.items ?? r.data ?? []))
      .catch(() => []);
  }, [canManageUsers]);

  const selectedLE = useMemo(
    () => legalEntities.find((le) => le.id === assignForm.legal_entity_id),
    [legalEntities, assignForm.legal_entity_id],
  );
  const assignableRoleNames = useMemo(
    () =>
      getAssignableRoles({
        scope: assignForm.scope,
        legalEntityCountry: assignForm.scope === 'LEGAL_ENTITY' ? (selectedLE?.country as PolicyCountry | undefined) : undefined,
      }),
    [assignForm.scope, selectedLE?.country],
  );
  const filteredRoles = useMemo(
    () => roles.filter((r) => assignableRoleNames.includes(r.name as any)),
    [roles, assignableRoleNames],
  );

  const roleDropdownDisabled =
    assignForm.scope === 'LEGAL_ENTITY' && !assignForm.legal_entity_id;
  const assignValid =
    assignForm.role &&
    (assignForm.scope === 'GLOBAL' || (assignForm.scope === 'LEGAL_ENTITY' && assignForm.legal_entity_id));

  useEffect(() => {
    if (roleDropdownDisabled && assignForm.role) {
      setAssignForm((f) => ({ ...f, role: '' }));
      return;
    }
    if (assignForm.role && !assignableRoleNames.includes(assignForm.role as any)) {
      setAssignForm((f) => ({ ...f, role: '' }));
    }
  }, [assignForm.role, assignableRoleNames, roleDropdownDisabled]);

  const handleAssign = async () => {
    if (!userId || !assignForm.role) return;
    if (assignForm.scope === 'LEGAL_ENTITY' && !assignForm.legal_entity_id) return;
    setSubmitting(true);
    try {
      await api.post(`/api/enterprise/users/${userId}/role-assignments`, {
        role: assignForm.role,
        scope: assignForm.scope,
        legal_entity_id: assignForm.scope === 'LEGAL_ENTITY' ? assignForm.legal_entity_id : undefined,
      });
      setAssignModal(false);
      setAssignForm({ scope: 'LEGAL_ENTITY', role: '', legal_entity_id: '' });
      load();
    } catch {
      // keep modal open on error
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async () => {
    if (!userId || !removeConfirm) return;
    const { role, scope, legalEntityId } = removeConfirm;
    try {
      await api.delete(`/api/enterprise/users/${userId}/role-assignments`, {
        data: { role, scope, legal_entity_id: scope === 'LEGAL_ENTITY' ? legalEntityId : undefined },
      });
      setRemoveConfirm(null);
      setToast('Role removed successfully.');
      load();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string | string[] } } };
      const msg = err?.response?.data?.message;
      setToast(
        typeof msg === 'string' ? msg : Array.isArray(msg) ? msg[0] : 'Failed to remove role.',
      );
    }
  };

  const isSensitiveRole = (role: string) =>
    ['TENANT_ADMIN', 'PLATFORM_SUPERADMIN'].includes(role);

  if (!canManageUsers) {
    return (
      <Page title="User" subtitle="Manage role assignments.">
        <ForbiddenEmptyState feature="User detail" description="You need iam:users:manage to assign roles." />
      </Page>
    );
  }

  const status = err?.response?.status ?? 0;
  if (status === 404 || status === 501) {
    return (
      <Page title="User" subtitle="Manage role assignments.">
        <UnavailableEmptyState feature="User detail" description="User not found or user management not available." />
      </Page>
    );
  }

  if (loading || !user) {
    return (
      <Page title="User" subtitle="Loading…">
        <Card><div style={{ padding: ui.space.xl, textAlign: 'center' }}>Loading…</div></Card>
      </Page>
    );
  }

  return (
    <Page
      title={user.display_name || user.email}
      subtitle={user.email}
      actions={
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Link
            to="/enterprise/users"
            style={{
              marginRight: 12,
              color: 'rgba(0,0,0,0.7)',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: 13,
            }}
          >
            ← Back
          </Link>
          <button
            type="button"
            onClick={() => {
              setAssignForm({ scope: 'LEGAL_ENTITY', role: '', legal_entity_id: '' });
              setAssignModal(true);
            }}
            style={{
              padding: '10px 18px',
              borderRadius: 10,
              border: '1px solid rgba(79,70,229,0.3)',
              background: 'rgba(79,70,229,0.12)',
              color: 'rgba(79,70,229,0.95)',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Assign role
          </button>
        </div>
      }
    >
      <Card>
        <CardHeader
          title="Role assignments"
          subtitle="Assign GLOBAL roles (tenant-wide) or LEGAL_ENTITY roles (per company)."
        />
      </Card>

      <Card>
        <div style={{ padding: ui.space.lg }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: 'rgba(0,0,0,0.5)', marginBottom: 4 }}>Identity</div>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
            <span><strong>Email:</strong> {user.email}</span>
            <span><strong>Status:</strong> {user.status}</span>
          </div>
        </div>
      </Card>

      <Section title="GLOBAL roles" subtitle="These roles apply across the entire tenant.">
        <Card>
          {!assignments?.global?.length ? (
            <div style={{ padding: ui.space.lg, color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>No GLOBAL roles assigned.</div>
          ) : (
            <div style={{ padding: ui.space.lg, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {assignments.global.map((a) => (
                <span
                  key={a.role}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: 'rgba(34,197,94,0.12)',
                    color: 'rgba(22,101,52,0.95)',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {a.role}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRemoveConfirm({ role: a.role, scope: 'GLOBAL' });
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: 'inherit',
                      opacity: 0.8,
                    }}
                    title="Remove"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>
      </Section>

      <Section title="LEGAL_ENTITY roles" subtitle="These roles apply only to the selected legal entity.">
        <Card>
          {!assignments?.legal_entities?.length ? (
            <div style={{ padding: ui.space.lg, color: 'rgba(0,0,0,0.5)', fontSize: 13 }}>No LEGAL_ENTITY roles assigned.</div>
          ) : (
            <div style={{ padding: ui.space.lg, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {assignments.legal_entities.map((le) => (
                <div key={le.legal_entity_id} style={{ paddingBottom: 16, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ fontWeight: 800, marginBottom: 8, fontSize: 14 }}>{le.legal_entity_name}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {le.roles.map((r) => (
                      <span
                        key={r}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px',
                          borderRadius: 999,
                          background: 'rgba(59,130,246,0.12)',
                          color: 'rgba(29,78,216,0.95)',
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        {r}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRemoveConfirm({
                              role: r,
                              scope: 'LEGAL_ENTITY',
                              legalEntityId: le.legal_entity_id,
                              legalEntityName: le.legal_entity_name,
                            });
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0,
                            color: 'inherit',
                            opacity: 0.8,
                          }}
                          title="Remove"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Section>

      {assignModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => !submitting && setAssignModal(false)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 14,
              padding: ui.space.xl,
              minWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 900 }}>Assign role</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 4 }}>Scope</label>
                <select
                  value={assignForm.scope}
                  onChange={(e) => {
                    const scope = e.target.value as RoleScopeType;
                    setAssignForm((f) => ({ ...f, scope, legal_entity_id: '', role: '' }));
                  }}
                  style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
                >
                  <option value="GLOBAL">GLOBAL</option>
                  <option value="LEGAL_ENTITY">LEGAL_ENTITY</option>
                </select>
              </div>
              {assignForm.scope === 'LEGAL_ENTITY' && (
                <div>
                  <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 4 }}>Legal entity</label>
                  <select
                    value={assignForm.legal_entity_id}
                    onChange={(e) => {
                      const legal_entity_id = e.target.value;
                      setAssignForm((f) => {
                        if (!legal_entity_id) return { ...f, legal_entity_id: '', role: '' };
                        const nextLE = legalEntities.find((le) => le.id === legal_entity_id);
                        const allowed = getAssignableRoles({
                          scope: 'LEGAL_ENTITY',
                          legalEntityCountry: nextLE?.country as PolicyCountry | undefined,
                        });
                        return {
                          ...f,
                          legal_entity_id,
                          role: allowed.includes(f.role as any) ? f.role : '',
                        };
                      });
                    }}
                    style={{ width: '100%', padding: 10, borderRadius: 10, border: '1px solid rgba(0,0,0,0.12)' }}
                    required
                  >
                    <option value="">Select…</option>
                    {legalEntities.map((le) => (
                      <option key={le.id} value={le.id}>
                        {le.name}{le.country ? ` (${le.country})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label style={{ fontSize: 12, fontWeight: 800, display: 'block', marginBottom: 4 }}>Role</label>
                <select
                  value={assignForm.role}
                  onChange={(e) => setAssignForm((f) => ({ ...f, role: e.target.value }))}
                  disabled={roleDropdownDisabled}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 10,
                    border: '1px solid rgba(0,0,0,0.12)',
                    opacity: roleDropdownDisabled ? 0.6 : 1,
                    cursor: roleDropdownDisabled ? 'not-allowed' : 'pointer',
                  }}
                  required
                >
                  <option value="">
                    {roleDropdownDisabled ? 'Select legal entity first…' : 'Select…'}
                  </option>
                  {!roleDropdownDisabled &&
                    filteredRoles.map((r) => (
                      <option key={r.name} value={r.name}>{r.name}</option>
                    ))}
                </select>
                {assignForm.scope === 'GLOBAL' && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                    Tenant-wide roles: TENANT_ADMIN, INTEGRATION_IGA, PLATFORM_SUPERADMIN
                  </div>
                )}
                {assignForm.scope === 'LEGAL_ENTITY' && !selectedLE && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                    Pick an entity first; ZA entities unlock SARS roles
                  </div>
                )}
                {assignForm.scope === 'LEGAL_ENTITY' && selectedLE && (
                  <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(0,0,0,0.55)' }}>
                    {selectedLE.country === 'ZA'
                      ? 'SARS roles available for ZA entities'
                      : 'SARS roles apply only to ZA entities'}
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
              <button type="button" onClick={() => !submitting && setAssignModal(false)} disabled={submitting}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAssign}
                disabled={submitting || !assignValid}
              >
                {submitting ? 'Assigning…' : 'Assign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {removeConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => setRemoveConfirm(null)}
        >
          <div
            style={{
              background: 'white',
              borderRadius: 14,
              padding: ui.space.xl,
              minWidth: 360,
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 900 }}>Remove role</h3>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: 'rgba(0,0,0,0.75)' }}>
              Remove <strong>{removeConfirm.role}</strong>
              {removeConfirm.scope === 'LEGAL_ENTITY' && removeConfirm.legalEntityName
                ? ` (${removeConfirm.legalEntityName})`
                : ' (GLOBAL)'}{' '}
              from {user?.display_name || user?.email}?
            </p>
            {isSensitiveRole(removeConfirm.role) && (
              <div
                style={{
                  marginBottom: 16,
                  padding: 12,
                  borderRadius: 10,
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  fontSize: 13,
                  color: 'rgba(185,28,28,0.95)',
                }}
              >
                Removing this role may affect access. You cannot remove your own last TENANT_ADMIN or PLATFORM_SUPERADMIN.
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button type="button" onClick={() => setRemoveConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRemove}
                style={{
                  background: 'rgba(239,68,68,0.9)',
                  color: 'white',
                  border: 'none',
                  padding: '10px 18px',
                  borderRadius: 10,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 20px',
            borderRadius: 12,
            background: toast.startsWith('Role removed') ? 'rgba(34,197,94,0.95)' : 'rgba(239,68,68,0.95)',
            color: 'white',
            fontSize: 14,
            fontWeight: 700,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 200,
          }}
        >
          {toast}
        </div>
      )}
    </Page>
  );
}
