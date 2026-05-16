import React from 'react';
import { ValidityState } from '@/lib/date-utils';

interface ValidityBadgeProps {
  state: ValidityState;
  days: number | null;
}

export default function ValidityBadge({ state, days }: ValidityBadgeProps) {
  let bgColor = 'bg-gray-100';
  let textColor = 'text-gray-800';

  switch (state) {
    case 'Active':
      bgColor = 'bg-green-100';
      textColor = 'text-green-800';
      break;
    case 'Expiring Soon':
      bgColor = 'bg-yellow-100';
      textColor = 'text-yellow-800';
      break;
    case 'Expired':
      bgColor = 'bg-red-100';
      textColor = 'text-red-800';
      break;
    case 'Missing End Date':
      bgColor = 'bg-gray-100';
      textColor = 'text-gray-600';
      break;
  }

  return (
    <div className="flex flex-col space-y-1">
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${bgColor} ${textColor}`}>
        {state}
      </span>
      {days !== null && (
        <span className="text-[10px] text-gray-500">
          {days < 0 ? `Expired ${Math.abs(days)} days ago` : `${days} days remaining`}
        </span>
      )}
    </div>
  );
}
