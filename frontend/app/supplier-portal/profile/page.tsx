'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import FormInput from '@/components/ui/form-input';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import { useAuth } from '@/lib/auth-context';
import { Building2, Pencil } from 'lucide-react';

interface SupplierProfile {
  id: string;
  companyName?: string | null;
  tradingName?: string | null;
  email: string;
  phone?: string | null;
  status: string;
  country: string;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
}

export default function SupplierPortalProfilePage() {
  const { can } = useAuth();
  const canEdit = can(PERMISSIONS.SUPPLIER_PROFILE.UPDATE);
  const [profile, setProfile] = useState<SupplierProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    tradingName: '',
    email: '',
    phone: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    postalCode: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await supplierPortalApi.getProfile();
      setProfile(data);
      setForm({
        tradingName: data.tradingName || data.companyName || '',
        email: data.email || '',
        phone: data.phone || '',
        addressLine1: data.addressLine1 || '',
        addressLine2: data.addressLine2 || '',
        city: data.city || '',
        postalCode: data.postalCode || '',
      });
    } catch {
      setError('Failed to load your supplier profile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await supplierPortalApi.updateProfile({
        tradingName: form.tradingName.trim() || undefined,
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        addressLine1: form.addressLine1.trim() || undefined,
        addressLine2: form.addressLine2.trim() || undefined,
        city: form.city.trim() || undefined,
        postalCode: form.postalCode.trim() || undefined,
      });
      setProfile(updated);
      setEditing(false);
      setSuccess('Profile updated.');
    } catch {
      setError('Failed to save profile changes.');
    } finally {
      setSaving(false);
    }
  };

  const displayName =
    profile?.companyName || profile?.tradingName || 'Your supplier';

  return (
    <RequirePermission permission={PERMISSIONS.SUPPLIER_PROFILE.READ}>
      <DashboardLayout>
        <div className="space-y-6 max-w-3xl">
          <PortalPageHeader
            title="Supplier profile"
            description="View and update your supplier organization details for this membership."
            action={
              canEdit && !editing && profile ? (
                <button
                  type="button"
                  className="btn btn-secondary inline-flex items-center gap-2"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="w-4 h-4" />
                  Edit profile
                </button>
              ) : null
            }
          />

          {loading && (
            <p className="text-gray-500 text-sm">Loading your profile…</p>
          )}
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
              {success}
            </p>
          )}

          {profile && !editing && (
            <div className="card space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-indigo-50 rounded-lg">
                  <Building2 className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{displayName}</h2>
                  <p className="text-sm text-gray-500">Status: {profile.status}</p>
                </div>
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-gray-500">Email</dt>
                  <dd className="font-medium text-gray-900">{profile.email}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Phone</dt>
                  <dd className="font-medium text-gray-900">{profile.phone || '—'}</dd>
                </div>
                <div>
                  <dt className="text-gray-500">Country</dt>
                  <dd className="font-medium text-gray-900">{profile.country}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-gray-500">Address</dt>
                  <dd className="font-medium text-gray-900">
                    {[profile.addressLine1, profile.addressLine2, profile.city, profile.postalCode]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          {profile && editing && (
            <form onSubmit={handleSave} className="card space-y-4">
              <h2 className="text-lg font-medium text-gray-900">Edit profile</h2>
              <FormInput
                label="Trading name"
                value={form.tradingName}
                onChange={(e) => setForm({ ...form, tradingName: e.target.value })}
              />
              <FormInput
                label="Email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <FormInput
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <FormInput
                label="Address line 1"
                value={form.addressLine1}
                onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
              />
              <FormInput
                label="Address line 2"
                value={form.addressLine2}
                onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormInput
                  label="City"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
                <FormInput
                  label="Postal code"
                  value={form.postalCode}
                  onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setEditing(false);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          )}
        </div>
      </DashboardLayout>
    </RequirePermission>
  );
}
