'use client';

import { useState, useEffect } from 'react';
import { PERMISSION_GROUPS } from '@/lib/permissions.generated';
import { Shield } from 'lucide-react';

interface RoleFormProps {
  initialData?: any;
  isSystemRole?: boolean;
  onSubmit: (data: any) => Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  saving: boolean;
}

export default function RoleForm({
  initialData,
  isSystemRole = false,
  onSubmit,
  onCancel,
  submitLabel,
  saving,
}: RoleFormProps) {
  const [name, setName] = useState(initialData?.name || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(initialData?.permissions || [])
  );

  const handleTogglePermission = (value: string) => {
    if (isSystemRole) return;
    const newSet = new Set(selectedPermissions);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    setSelectedPermissions(newSet);
  };

  const handleToggleGroup = (groupPermissions: any[]) => {
    if (isSystemRole) return;
    const newSet = new Set(selectedPermissions);
    const allSelected = groupPermissions.every((p) => newSet.has(p.value));
    
    if (allSelected) {
      groupPermissions.forEach((p) => newSet.delete(p.value));
    } else {
      groupPermissions.forEach((p) => newSet.add(p.value));
    }
    setSelectedPermissions(newSet);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSystemRole) return;
    
    onSubmit({
      name,
      description,
      permissions: Array.from(selectedPermissions),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <div className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Role Name
          </label>
          <input
            type="text"
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={isSystemRole || saving}
            required
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isSystemRole || saving}
            rows={3}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500 sm:text-sm disabled:bg-gray-100 disabled:text-gray-500"
          />
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 flex items-center mb-4">
          <Shield className="w-5 h-5 mr-2 text-primary-600" />
          Permissions
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PERMISSION_GROUPS.map((group) => {
            const allSelected = group.permissions.every((p) => selectedPermissions.has(p.value));
            const someSelected = group.permissions.some((p) => selectedPermissions.has(p.value)) && !allSelected;

            return (
              <div key={group.resource} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between items-center">
                  <span className="font-medium text-sm text-gray-900">{group.label}</span>
                  {!isSystemRole && (
                    <button
                      type="button"
                      onClick={() => handleToggleGroup(group.permissions)}
                      disabled={saving}
                      className="text-xs text-primary-600 hover:text-primary-900 font-medium"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div className="p-4 space-y-3">
                  {group.permissions.map((perm) => (
                    <label key={perm.value} className="flex items-start cursor-pointer">
                      <div className="flex items-center h-5">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.has(perm.value)}
                          onChange={() => handleTogglePermission(perm.value)}
                          disabled={isSystemRole || saving}
                          className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded disabled:opacity-50"
                        />
                      </div>
                      <div className="ml-3 text-sm">
                        <span className="font-medium text-gray-700">{perm.label}</span>
                        <p className="text-xs text-gray-500 font-mono mt-0.5">{perm.value}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex justify-end space-x-3 border-t border-gray-200 pt-6">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          {isSystemRole ? 'Back' : 'Cancel'}
        </button>
        {!isSystemRole && (
          <button
            type="submit"
            disabled={saving || name.trim() === ''}
            className="inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {saving ? 'Saving...' : submitLabel}
          </button>
        )}
      </div>
    </form>
  );
}
