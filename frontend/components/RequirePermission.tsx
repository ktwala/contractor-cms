'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { Permission } from '@/lib/permissions.generated';

interface RequirePermissionProps {
  children: React.ReactNode;
  permission?: Permission | Permission[];
  requireAll?: boolean;
}

export default function RequirePermission({
  children,
  permission,
  requireAll = false,
}: RequirePermissionProps) {
  const { user, loading, can, canAny, canAll } = useAuth();
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!permission) {
      setIsAuthorized(true);
      return;
    }

    let authorized = false;

    if (Array.isArray(permission)) {
      authorized = requireAll ? canAll(permission) : canAny(permission);
    } else {
      authorized = can(permission);
    }

    if (!authorized) {
      router.push('/403');
    } else {
      setIsAuthorized(true);
    }
  }, [user, loading, permission, requireAll, can, canAny, canAll, router]);

  if (loading || isAuthorized === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return isAuthorized ? <>{children}</> : null;
}
