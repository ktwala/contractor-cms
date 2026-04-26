'use client';

import { ReactNode } from 'react';

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage system administration settings including users and roles.
        </p>
      </div>
      <div className="bg-white shadow rounded-lg p-6">
        {children}
      </div>
    </div>
  );
}
