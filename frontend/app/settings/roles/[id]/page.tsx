'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import RequirePermission from '@/components/RequirePermission';
import RoleForm from '@/components/ui/role-form';
import { ArrowLeft, Lock, Trash2 } from 'lucide-react';
import Link from 'next/link';

export default function RoleDetailsPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const roleId = params?.id ?? '';
  const { can } = useAuth();
  
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (roleId) {
      fetchRole();
    }
  }, [roleId]);

  const fetchRole = async () => {
    try {
      const data = await api.getRole(roleId);
      setRole(data);
    } catch (error) {
      console.error('Failed to fetch role', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (data: any) => {
    try {
      setSaving(true);
      await api.updateRole(role.id, data);
      router.push('/settings/roles');
    } catch (error) {
      console.error('Failed to update role', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this role? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      await api.deleteRole(role.id);
      router.push('/settings/roles');
    } catch (error) {
      console.error('Failed to delete role', error);
      setDeleting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!role) {
    return <div className="text-center py-10">Role not found</div>;
  }

  return (
    <RequirePermission permission={PERMISSIONS.ROLES.READ}>
      <div className="space-y-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center space-x-4">
            <Link
              href="/settings/roles"
              className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div>
              <div className="flex items-center">
                <h2 className="text-xl font-semibold text-gray-800 mr-3">
                  {role.isSystemRole ? 'System Role Details' : 'Edit Custom Role'}
                </h2>
                {role.isSystemRole && (
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                    <Lock className="w-3 h-3 mr-1" />
                    System
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {role.isSystemRole 
                  ? 'System roles are protected and cannot be modified.' 
                  : 'Modify this role and its specific permissions.'}
              </p>
            </div>
          </div>

          {!role.isSystemRole && can(PERMISSIONS.ROLES.DELETE) && (
            <button
              onClick={handleDelete}
              disabled={deleting || saving}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              {deleting ? 'Deleting...' : 'Delete Role'}
            </button>
          )}
        </div>

        <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
          <RoleForm
            initialData={role}
            isSystemRole={role.isSystemRole || (!can(PERMISSIONS.ROLES.UPDATE) && !role.isSystemRole)}
            onSubmit={handleUpdate}
            onCancel={() => router.push('/settings/roles')}
            submitLabel="Save Changes"
            saving={saving}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
