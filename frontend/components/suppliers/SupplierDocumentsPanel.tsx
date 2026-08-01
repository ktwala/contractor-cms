'use client';

import { useEffect, useState } from 'react';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import {
  SupplierDocumentView,
  SupplierJurisdictionCode,
  evidenceTypeOptionsForJurisdiction,
  resolveSupplierJurisdictionCode,
} from '@/lib/supplier-evidence';
import { useAuth } from '@/lib/auth-context';
import { PERMISSIONS } from '@/lib/permissions.generated';

type SupplierDocumentsPanelProps = {
  supplierId: string;
  country?: string | null;
  countryCode?: string | null;
  onChanged?: () => void;
};

export default function SupplierDocumentsPanel({
  supplierId,
  country,
  countryCode,
  onChanged,
}: SupplierDocumentsPanelProps) {
  const jurisdiction: SupplierJurisdictionCode = resolveSupplierJurisdictionCode(
    country,
    countryCode,
  );
  const evidenceTypeOptions = evidenceTypeOptionsForJurisdiction(jurisdiction);
  const { showToast } = useToast();
  const { can } = useAuth();
  const canUpdate = can(PERMISSIONS.SUPPLIERS.UPDATE);

  const [documents, setDocuments] = useState<SupplierDocumentView[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    type: evidenceTypeOptions[0]?.value ?? 'COMPANY_REGISTRATION',
    fileName: '',
    fileSize: '1024',
    mimeType: 'application/pdf',
    expiryDate: '',
    notes: '',
  });

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const rows = await api.getSupplierDocuments(supplierId);
      setDocuments(rows);
    } catch {
      showToast('error', 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fileName.trim()) {
      showToast('error', 'File name is required');
      return;
    }

    setSubmitting(true);
    try {
      await api.createSupplierDocument(supplierId, {
        type: form.type,
        fileName: form.fileName.trim(),
        fileSize: Number(form.fileSize) || 0,
        mimeType: form.mimeType.trim() || 'application/pdf',
        expiryDate: form.expiryDate || undefined,
        notes: form.notes.trim() || undefined,
      });
      showToast('success', 'Document metadata registered');
      setForm((prev) => ({ ...prev, fileName: '', expiryDate: '', notes: '' }));
      await loadDocuments();
      onChanged?.();
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? 'Failed to register document';
      showToast('error', String(message));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium text-gray-900">Registered documents</h3>
        <p className="text-sm text-gray-500 mt-1">
          Metadata only in this release — bank/tax identifiers on the supplier profile remain
          permission-gated.
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Loading documents…</p>
      ) : documents.length === 0 ? (
        <p className="text-sm text-gray-500">No documents registered yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white">
          {documents.map((doc) => (
            <li key={doc.id} className="px-4 py-3 text-sm">
              <div className="flex justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{doc.fileName}</p>
                  <p className="text-xs text-gray-500">{doc.type}</p>
                  {doc.expiryDate && (
                    <p className="text-xs text-gray-500 mt-1">
                      Expires {new Date(doc.expiryDate).toLocaleDateString()}
                    </p>
                  )}
                </div>
                {doc.expired && (
                  <span className="shrink-0 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                    Expired
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canUpdate && (
        <form onSubmit={handleRegister} className="rounded-lg border border-gray-200 p-4 space-y-3 bg-gray-50">
          <p className="text-sm font-medium text-gray-900">Register document metadata</p>
          <FormSelect
            label="Document type"
            value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            options={evidenceTypeOptions}
          />
          <FormInput
            label="File name"
            value={form.fileName}
            onChange={(e) => setForm({ ...form, fileName: e.target.value })}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            <FormInput
              label="File size (bytes)"
              type="number"
              value={form.fileSize}
              onChange={(e) => setForm({ ...form, fileSize: e.target.value })}
            />
            <FormInput
              label="MIME type"
              value={form.mimeType}
              onChange={(e) => setForm({ ...form, mimeType: e.target.value })}
            />
          </div>
          <FormInput
            label="Expiry date"
            type="date"
            value={form.expiryDate}
            onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
          />
          <FormInput
            label="Notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
          <button type="submit" disabled={submitting} className="btn btn-primary">
            {submitting ? 'Saving…' : 'Register document'}
          </button>
        </form>
      )}
    </div>
  );
}
