'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import RequirePermission from '@/components/RequirePermission';
import Link from 'next/link';
import { Shield, Plus, Lock } from 'lucide-react';

export default function RolesPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { can } = useAuth();

  useEffect(() => {
    fetchRoles();
  }, []);

  const fetchRoles = async () => {
    try {
      const data = await api.getRoles();
      setRoles(data);
    } catch (error) {
      console.error('Failed to fetch roles', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <RequirePermission permission={PERMISSIONS.ROLES.READ}>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">Role Management</h2>
          {can(PERMISSIONS.ROLES.CREATE) && (
            <Link
              href="/settings/roles/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              <Plus className="w-5 h-5 mr-2 -ml-1" />
              Create Role
            </Link>
          )}
        </div>

        {loading ? (
          <div className="text-center py-10 text-gray-500">Loading roles...</div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Edit</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <Shield className={`h-5 w-5 mr-2 ${role.isSystemRole ? 'text-gray-400' : 'text-primary-600'}`} />
                        <span className="text-sm font-medium text-gray-900">{role.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-500 line-clamp-2">{role.description || '-'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {role.isSystemRole ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800" title="System roles are protected and cannot be modified.">
                          <Lock className="w-3 h-3 mr-1" />
                          System
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Custom
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Link
                        href={`/settings/roles/${role.id}`}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        {role.isSystemRole ? 'View' : 'Edit'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {roles.length === 0 && (
              <div className="text-center py-6 text-gray-500">
                No roles available.
              </div>
            )}
          </div>
        )}
      </div>
    </RequirePermission>
  );
}
