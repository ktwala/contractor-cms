import { LucideIcon } from 'lucide-react';

interface PortalEmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function PortalEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: PortalEmptyStateProps) {
  return (
    <div className="card flex flex-col items-center text-center py-12 px-6">
      <div className="p-3 rounded-full bg-gray-100 mb-4">
        <Icon className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-2 max-w-md">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
