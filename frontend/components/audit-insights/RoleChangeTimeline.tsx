'use client';

import { Activity, ArrowRight, UserCog } from 'lucide-react';

interface TimelineChange {
  action: string;
  roleName?: string;
  assignedBy: any;
  timestamp: string;
}

interface RoleChangeTimeline {
  targetUserId: string;
  targetUserEmail: string;
  changes: TimelineChange[];
}

interface RoleChangeTimelineProps {
  timelines: RoleChangeTimeline[];
}

export default function RoleChangeTimeline({ timelines }: RoleChangeTimelineProps) {
  if (timelines.length === 0) {
    return (
      <div className="card">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Role Change Timeline</h2>
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <Activity className="w-12 h-12 mb-3 text-gray-300" />
          <p>No role changes recorded in this period.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-lg font-semibold text-gray-900 mb-6">Role Change Timeline</h2>
      <div className="space-y-8">
        {timelines.map((timeline) => (
          <div key={timeline.targetUserId} className="relative">
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 rounded-lg mr-3">
                <UserCog className="w-5 h-5 text-purple-600" />
              </div>
              <h3 className="text-sm font-medium text-gray-900">{timeline.targetUserEmail}</h3>
            </div>
            
            <div className="ml-5 border-l-2 border-gray-200 pl-6 pb-2 space-y-6">
              {timeline.changes.map((change, idx) => (
                <div key={idx} className="relative">
                  <div className={`absolute -left-[31px] w-4 h-4 rounded-full border-2 border-white ${
                    change.action === 'USER_ROLE_ASSIGNED' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {change.action === 'USER_ROLE_ASSIGNED' ? 'Assigned' : 'Removed'} Role
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        By: {change.assignedBy?.email || 'System'}
                      </p>
                    </div>
                    <div className="mt-2 sm:mt-0 text-right">
                      <p className="text-xs text-gray-500">
                        {new Date(change.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
