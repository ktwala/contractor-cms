'use client';

import { Shield, ShieldAlert, AlertTriangle, Info } from 'lucide-react';

interface HighRiskEvent {
  id: string;
  timestamp: string;
  actor: any;
  action: string;
  target: any;
  riskLevel: string;
  reason?: string;
}

interface HighRiskTableProps {
  events: HighRiskEvent[];
  title?: string;
}

const RiskBadge = ({ level }: { level: string }) => {
  switch (level.toLowerCase()) {
    case 'critical':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <ShieldAlert className="w-3 h-3 mr-1" /> Critical
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
          <AlertTriangle className="w-3 h-3 mr-1" /> High
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <Shield className="w-3 h-3 mr-1" /> Medium
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Info className="w-3 h-3 mr-1" /> Low
        </span>
      );
  }
};

export default function HighRiskTable({ events, title = 'High-Risk Events' }: HighRiskTableProps) {
  if (events.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Shield className="w-12 h-12 mb-3 text-gray-300" />
          <p>No high-risk events detected in this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">{title}</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timestamp
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Risk Level
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actor
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Reason
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(event.timestamp).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <RiskBadge level={event.riskLevel} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {event.action}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {event.actor?.email || 'System'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {event.reason || 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
