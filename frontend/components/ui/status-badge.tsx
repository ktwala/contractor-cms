interface StatusBadgeProps {
  status: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export default function StatusBadge({ status, variant }: StatusBadgeProps) {
  const getVariantClasses = () => {
    if (variant) {
      const variants = {
        default: 'bg-gray-100 text-gray-800',
        success: 'bg-green-100 text-green-800',
        warning: 'bg-yellow-100 text-yellow-800',
        danger: 'bg-red-100 text-red-800',
        info: 'bg-blue-100 text-blue-800',
      };
      return variants[variant];
    }

    // Auto-detect from status
    const statusUpper = status.toUpperCase();
    if (['ACTIVE', 'APPROVED', 'PAID', 'SYNCED', 'COMPLETED'].includes(statusUpper)) {
      return 'bg-green-100 text-green-800';
    }
    if (['PENDING', 'SUBMITTED', 'IN_PROGRESS'].includes(statusUpper)) {
      return 'bg-yellow-100 text-yellow-800';
    }
    if (['REJECTED', 'FAILED', 'VOID', 'CANCELLED'].includes(statusUpper)) {
      return 'bg-red-100 text-red-800';
    }
    if (['DRAFT', 'INACTIVE'].includes(statusUpper)) {
      return 'bg-gray-100 text-gray-800';
    }
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <span
      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getVariantClasses()}`}
    >
      {status}
    </span>
  );
}
