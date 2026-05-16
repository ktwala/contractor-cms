'use client';

import { Building2, Users, FileText, Clock } from 'lucide-react';
import Link from 'next/link';
import { ContractRenewalsWidget } from './ContractRenewalsWidget';

export default function OperationalDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Operational Dashboard</h2>
        <p className="text-sm text-gray-500 mt-1">Manage your organization's resources and workflows.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/suppliers" className="block">
          <div className="card hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-indigo-500">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-indigo-50 rounded-lg">
                <Building2 className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Suppliers</h3>
                <p className="text-sm text-gray-500">Manage supplier entities</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/contractors" className="block">
          <div className="card hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-blue-500">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Contractors</h3>
                <p className="text-sm text-gray-500">Manage individuals</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/contracts" className="block">
          <div className="card hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-purple-500">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-purple-50 rounded-lg">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Contracts</h3>
                <p className="text-sm text-gray-500">View engagements</p>
              </div>
            </div>
          </div>
        </Link>

        <Link href="/timesheets" className="block">
          <div className="card hover:shadow-md transition-shadow cursor-pointer h-full border-l-4 border-amber-500">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-amber-50 rounded-lg">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Timesheets</h3>
                <p className="text-sm text-gray-500">Review and approve</p>
              </div>
            </div>
          </div>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-8">
        <div className="lg:col-span-2">
          <div className="card h-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
            <div className="flex items-center justify-center h-32 text-gray-500">
              <p>Navigate to specific modules to view detailed activity.</p>
            </div>
          </div>
        </div>
        <div className="lg:col-span-1">
          <ContractRenewalsWidget />
        </div>
      </div>
    </div>
  );
}
