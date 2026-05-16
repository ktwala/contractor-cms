'use client';

import { ShieldAlert, Users, ShieldOff, Download, UserX, AlertOctagon, Fingerprint } from 'lucide-react';

interface SummaryCardsProps {
  summary: {
    roleChangesLast24h: number;
    failedAdminActions: number;
    newUsersCreated: number;
    deactivatedUsers: number;
    auditExports: number;
    criticalAnomalies?: number;
    spoofAttempts?: number;
  };
}

export default function SummaryCards({ summary }: SummaryCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="card border-red-500 border-l-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Critical Anomalies</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {summary.criticalAnomalies || 0}
            </p>
          </div>
          <div className="p-3 bg-red-100 rounded-lg">
            <AlertOctagon className="w-6 h-6 text-red-600" />
          </div>
        </div>
      </div>

      <div className="card border-orange-500 border-l-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Spoofing Attempts</p>
            <p className="text-2xl font-bold text-orange-600 mt-1">
              {summary.spoofAttempts || 0}
            </p>
          </div>
          <div className="p-3 bg-orange-100 rounded-lg">
            <Fingerprint className="w-6 h-6 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Failed Actions</p>
            <p className="text-2xl font-bold text-red-600 mt-1">
              {summary.failedAdminActions}
            </p>
          </div>
          <div className="p-3 bg-red-100 rounded-lg">
            <ShieldAlert className="w-6 h-6 text-red-600" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Role Changes (24h)</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summary.roleChangesLast24h}
            </p>
          </div>
          <div className="p-3 bg-blue-100 rounded-lg">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">New Users</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {summary.newUsersCreated}
            </p>
          </div>
          <div className="p-3 bg-green-100 rounded-lg">
            <Users className="w-6 h-6 text-green-600" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Deactivated Users</p>
            <p className="text-2xl font-bold text-yellow-600 mt-1">
              {summary.deactivatedUsers}
            </p>
          </div>
          <div className="p-3 bg-yellow-100 rounded-lg">
            <UserX className="w-6 h-6 text-yellow-600" />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Audit Exports</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">
              {summary.auditExports}
            </p>
          </div>
          <div className="p-3 bg-gray-100 rounded-lg">
            <Download className="w-6 h-6 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}
