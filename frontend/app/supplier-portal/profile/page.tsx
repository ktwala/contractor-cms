'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';

export default function SupplierPortalProfilePage() {
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    supplierPortalApi
      .getProfile()
      .then(setProfile)
      .catch(() => setError('Failed to load supplier profile'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_PROFILE.READ}>
      <DashboardLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Supplier profile</h1>
            <p className="text-sm text-gray-500 mt-1">
              Your organization&apos;s supplier record (membership-scoped).
            </p>
          </div>

          {loading && <p className="text-gray-500">Loading…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {profile && (
            <div className="card space-y-3">
              <p>
                <span className="text-gray-500">Company:</span>{' '}
                <strong>{String(profile.companyName || profile.tradingName || '—')}</strong>
              </p>
              <p>
                <span className="text-gray-500">Email:</span> {String(profile.email || '—')}
              </p>
              <p>
                <span className="text-gray-500">Status:</span> {String(profile.status || '—')}
              </p>
              <p>
                <span className="text-gray-500">Country:</span> {String(profile.country || '—')}
              </p>
            </div>
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
