'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';
import RequirePermission from '@/components/RequirePermission';
import { useParams, useRouter } from 'next/navigation';
import { User, Shield, Check, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function UserDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { can } = useAuth();
  
  const [user, setUser] = useState<any>(null);
  const [allRoles, setAllRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Local state for role selection
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userData, rolesData] = await Promise.all([
        api.getUser(params.id as string),
        api.getRoles(),
      ]);
      setUser(userData);
      setAllRoles(rolesData);
      
      const roleIds = new Set<string>(userData.roles.map((ur: any) => ur.roleId));
      setSelectedRoleIds(roleIds);
    } catch (error) {
      console.error('Failed to fetch user data', error);
      // Let the global interceptor handle the toast
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!user) return;
    
    try {
      setSaving(true);
      const updatedUser = await api.updateUser(user.id, { isActive: !user.isActive });
      setUser(updatedUser);
    } catch (error: any) {
      // The global API interceptor handles the toast display for 403, 409, 400.
      console.error('Failed to update user status', error);
    } finally {
      setSaving(false);
    }
  };

  const handleRoleToggle = (roleId: string) => {
    const newSet = new Set(selectedRoleIds);
    if (newSet.has(roleId)) {
      newSet.delete(roleId);
    } else {
      newSet.add(roleId);
    }
    setSelectedRoleIds(newSet);
  };

  const saveRoles = async () => {
    try {
      setSaving(true);
      const roleIdsArray = Array.from(selectedRoleIds);
      const updatedUser = await api.assignRoles(user.id, roleIdsArray);
      setUser(updatedUser);
      // Toast on success could be added here
    } catch (error) {
      console.error('Failed to save roles', error);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-10">Loading...</div>;
  }

  if (!user) {
    return <div className="text-center py-10">User not found</div>;
  }

  return (
    <RequirePermission permission={PERMISSIONS.USERS.READ}>
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/settings/users')}
            className="p-2 bg-gray-100 rounded-full hover:bg-gray-200"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h2 className="text-xl font-semibold text-gray-800">User Details</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* User Info Card */}
          <div className="bg-white p-6 shadow rounded-lg border border-gray-200 col-span-1">
            <div className="flex flex-col items-center">
              <div className="h-24 w-24 bg-primary-100 rounded-full flex items-center justify-center mb-4">
                <User className="h-12 w-12 text-primary-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">
                {user.firstName} {user.lastName}
              </h3>
              <p className="text-sm text-gray-500 mb-4">{user.email}</p>
              
              <div className="w-full border-t border-gray-200 pt-4 mt-2">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-gray-500">Status</span>
                  {user.isActive ? (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                      Inactive
                    </span>
                  )}
                </div>
                
                {can(PERMISSIONS.USERS.DEACTIVATE) && (
                  <button
                    onClick={handleToggleActive}
                    disabled={saving}
                    className={`mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                      user.isActive 
                        ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' 
                        : 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
                    } disabled:opacity-50`}
                  >
                    {saving ? 'Processing...' : user.isActive ? 'Deactivate User' : 'Activate User'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Role Assignment Card */}
          <div className="bg-white p-6 shadow rounded-lg border border-gray-200 col-span-1 md:col-span-2">
            <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-primary-600" />
              Role Assignments
            </h3>
            
            <p className="text-sm text-gray-500 mb-6">
              Assign or revoke roles for this user. System roles provide base permissions, while custom roles provide specific access.
            </p>

            <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
              {allRoles.map((role) => {
                const isSelected = selectedRoleIds.has(role.id);
                return (
                  <label
                    key={role.id}
                    className={`relative flex items-start p-4 cursor-pointer rounded-lg border ${
                      isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center h-5">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                        checked={isSelected}
                        onChange={() => handleRoleToggle(role.id)}
                        disabled={!can(PERMISSIONS.ROLES.ASSIGN) || saving}
                      />
                    </div>
                    <div className="ml-3 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {role.name}
                        {role.isSystemRole && (
                          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            System
                          </span>
                        )}
                      </span>
                      {role.description && (
                        <span className="block text-sm text-gray-500">{role.description}</span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>

            {can(PERMISSIONS.ROLES.ASSIGN) && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={saveRoles}
                  disabled={saving}
                  className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Role Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </RequirePermission>
  );
}
