'use client';

import { useCallback, useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import RequirePermission from '@/components/RequirePermission';
import PortalPageHeader from '@/components/supplier-portal/PortalPageHeader';
import FormInput from '@/components/ui/form-input';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { supplierPortalApi } from '@/lib/api-supplier-portal';
import {
  getSupplierPortalErrorMessage,
  isSupplierPortalLoadFailure,
} from '@/lib/supplier-portal-errors';
import { SUPPLIER_NOT_LINKED_TITLE } from '@/lib/supplier-portal-context';
import { useAuth } from '@/lib/auth-context';
import { useSupplierPortalGate } from '@/hooks/use-supplier-portal-gate';
import PortalEmptyState from '@/components/supplier-portal/PortalEmptyState';
import {
  SUPPLIER_PORTAL_EMPTY_COPY,
  SUPPLIER_PORTAL_EMPTY_STATES,
  unwrapSupplierPortalProfile,
} from '@/lib/supplier-portal-response';
import SupplierEvidenceChecklist from '@/components/suppliers/SupplierEvidenceChecklist';
import { EvidenceChecklistResult } from '@/lib/supplier-evidence';
import { Building2, Pencil, Send } from 'lucide-react';
import {
  supplierPortalProfileDescription,
  supplierPortalProfileTitle,
} from '@/lib/tenant-authority';

interface SupplierPortalOnboarding {
  jurisdictionCode: string;
  evidenceComplete: boolean;
  missingCount: number;
  expiredCount: number;
  canSubmit: boolean;
  inApprovalQueue: boolean;
}

interface SupplierProfile {
  id: string;
  companyName?: string | null;
  tradingName?: string | null;
  email: string;
  phone?: string | null;
  status: string;
  country: string;
  countryCode?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  postalCode?: string | null;
  onboarding?: SupplierPortalOnboarding;
  evidenceChecklist?: EvidenceChecklistResult;
}

export default function SupplierPortalProfilePage() {
  const { can, user } = useAuth();
  const { ready, supplierLinked, blockedMessage, guardApiCall } = useSupplierPortalGate();
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
  const [emptyState, setEmptyState] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const canSubmitOnboarding = can(PERMISSIONS.SUPPLIER_ONBOARDING.SUBMIT);

  const loadProfile = useCallback(async () => {
    if (!guardApiCall(true)) {
      setLoading(false);
      setProfile(null);
      return;
    }
    setLoading(true);
    setError('');
    setEmptyState(null);
    try {
      const response = await supplierPortalApi.getProfile();
      const { profile, emptyState: apiEmpty } =
        unwrapSupplierPortalProfile<SupplierProfile>(response);
      if (!profile) {
        setProfile(null);
        setEmptyState(apiEmpty ?? SUPPLIER_PORTAL_EMPTY_STATES.NO_PROFILE);
        return;
      }
      setProfile(profile);
      setForm({
        tradingName: profile.tradingName || profile.companyName || '',
        email: profile.email || '',
        phone: profile.phone || '',
        addressLine1: profile.addressLine1 || '',
        addressLine2: profile.addressLine2 || '',
        city: profile.city || '',
        postalCode: profile.postalCode || '',
      });
    } catch (err) {
      if (isSupplierPortalLoadFailure(err)) {
        setError(
          getSupplierPortalErrorMessage(
            err,
            'The server could not load your supplier profile.',
          ),
        );
      }
    } finally {
      setLoading(false);
    }
  }, [guardApiCall]);

  useEffect(() => {
    if (ready) {
      loadProfile();
    }
  }, [ready, loadProfile]);

  const handleSubmitForApproval = async () => {
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await supplierPortalApi.submitForApproval();
      const message =
        response?.data?.message ??
        'Your supplier has been submitted for operations approval.';
      setSuccess(message);
      await loadProfile();
    } catch (err: unknown) {
      const body =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string; checklist?: unknown } } })
              .response?.data
          : undefined;
      setError(
        body?.message ??
          'Cannot submit for approval until all required evidence is uploaded and valid.',
      );
    } finally {
      setSubmitting(false);
    }
  };

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
            title={supplierPortalProfileTitle(user?.tenantAuthority)}
            description={supplierPortalProfileDescription(user?.tenantAuthority)}
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

          {!supplierLinked && ready && (
            <PortalEmptyState
              icon={Building2}
              title={SUPPLIER_NOT_LINKED_TITLE}
              description={blockedMessage ?? 'No supplier membership is active for your account.'}
            />
          )}

          {supplierLinked && loading && (
            <p className="text-gray-500 text-sm">Loading your profile…</p>
          )}
          {supplierLinked && emptyState && !loading && !error && (
            <PortalEmptyState
              icon={Building2}
              title={
                SUPPLIER_PORTAL_EMPTY_COPY[
                  emptyState as keyof typeof SUPPLIER_PORTAL_EMPTY_COPY
                ]?.title ?? 'No supplier profile'
              }
              description={
                SUPPLIER_PORTAL_EMPTY_COPY[
                  emptyState as keyof typeof SUPPLIER_PORTAL_EMPTY_COPY
                ]?.description ??
                'No supplier profile linked to this account.'
              }
            />
          )}

          {supplierLinked && error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-4 py-3">{error}</p>
          )}
          {success && (
            <p className="text-sm text-green-700 bg-green-50 rounded-lg px-4 py-3">
              {success}
            </p>
          )}

          {supplierLinked && profile && !editing && (
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

              {profile.onboarding?.inApprovalQueue && (
                <p className="text-sm text-indigo-700 bg-indigo-50 rounded-lg px-4 py-3">
                  Your supplier is in the operations approval queue.
                  {profile.onboarding.evidenceComplete
                    ? ' Evidence is complete — awaiting client approval to Active.'
                    : ' Complete all required evidence before operations can approve.'}
                </p>
              )}

              {profile.evidenceChecklist && (
                <SupplierEvidenceChecklist
                  checklist={profile.evidenceChecklist}
                  compact
                />
              )}

              {canSubmitOnboarding &&
                profile.onboarding &&
                (profile.status === 'DRAFT' || profile.status === 'PENDING_APPROVAL') && (
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-gray-100">
                    <button
                      type="button"
                      className="btn btn-primary inline-flex items-center gap-2"
                      disabled={!profile.onboarding.canSubmit || submitting}
                      onClick={handleSubmitForApproval}
                    >
                      <Send className="w-4 h-4" />
                      {submitting ? 'Submitting…' : 'Submit for approval'}
                    </button>
                    {!profile.onboarding.canSubmit && (
                      <p className="text-sm text-gray-500">
                        Upload all required jurisdiction documents before submitting.
                      </p>
                    )}
                  </div>
                )}
            </div>
          )}

          {supplierLinked && profile && editing && (
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
