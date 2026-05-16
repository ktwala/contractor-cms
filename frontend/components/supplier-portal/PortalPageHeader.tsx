interface PortalPageHeaderProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export default function PortalPageHeader({
  title,
  description,
  action,
}: PortalPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          Supplier portal
        </p>
        <h1 className="text-2xl font-semibold text-gray-900 mt-1">{title}</h1>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
