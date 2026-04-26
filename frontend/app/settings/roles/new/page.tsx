'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { PERMISSIONS } from '@/lib/permissions.generated';
import RequirePermission from '@/components/RequirePermission';
import RoleForm from '@/components/ui/role-form';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function CreateRolePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (data: any) => {
    try {
      setSaving(true);
      await api.createRole(data);
      router.push('/settings/roles');
    } catch (error) {
      console.error('Failed to create role', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <RequirePermission permission={PERMISSIONS.ROLES.CREATE}>
      <div className="space-y-6">
        <div className="flex items-center space-x-4 mb-6">
          <Link
            href="/settings/roles"
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Create Custom Role</h2>
            <p className="text-sm text-gray-500">Define a new role and its specific permissions.</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg border border-gray-200 p-6">
          <RoleForm
            onSubmit={handleSubmit}
            onCancel={() => router.push('/settings/roles')}
            submitLabel="Create Role"
            saving={saving}
          />
        </div>
      </div>
    </RequirePermission>
  );
}
