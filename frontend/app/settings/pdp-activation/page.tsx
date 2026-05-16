'use client';

import { PdpActivationConsole } from '@/pages/settings/PdpActivationConsole';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';

export default function PdpActivationPage() {
  const { user, can } = useAuth();
  
  if (!user) return null;

  if (!can(PERMISSIONS.PDP_ACTIVATION.VIEW)) {
    return (
      <div className="p-8 text-center text-gray-500">You do not have permission to view governance activation.</div>
    );
  }

  return <PdpActivationConsole />;
}
