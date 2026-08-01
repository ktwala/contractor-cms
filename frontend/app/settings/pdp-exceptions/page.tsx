'use client';

import { PdpExceptionQueue } from '@/components/pdp/PdpExceptionQueue';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';

export default function PdpExceptionsPage() {
  const { user, can } = useAuth();
  
  if (!user) return null;

  if (!can(PERMISSIONS.PDP_EXCEPTIONS.VIEW)) {
    return (
      <div className="p-8 text-center text-gray-500">You do not have permission to view governance exceptions.</div>
    );
  }

  return <PdpExceptionQueue />;
}
