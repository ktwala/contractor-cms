'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/dashboard-layout';
import ContractorFormModal from '@/components/contractors/ContractorFormModal';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Edit, Trash2, Search, User, Download } from 'lucide-react';
import { exportContractorsToCSV } from '@/lib/csv-export';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { useAuth } from '@/lib/auth-context';
import { formatSupplierDisplayName } from '@/lib/supplier-display';
import { EXTERNAL_WORKFORCE_LABELS } from '@/lib/external-workforce-labels';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

interface Contractor {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  taxNumber?: string;
  idNumber?: string;
  dateOfBirth?: string;
  nationality?: string;
  status: string;
  supplierId: string;
  supplier?: {
    id: string;
    type?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
}

interface Supplier {
  id: string;
  type?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  status?: string;
  externalSupplierId?: string | null;
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [governancePhase, setGovernancePhase] = useState<'NO_CUTOVER' | 'PRE_CUTOVER' | 'POST_CUTOVER'>('NO_CUTOVER');
  const { showToast } = useToast();
  const { can } = useAuth();
  const canMutateContractors =
    can(PERMISSIONS.CONTRACTORS.CREATE) ||
    can(PERMISSIONS.CONTRACTORS.UPDATE) ||
    can(PERMISSIONS.CONTRACTORS.DELETE);

  const loadData = useCallback(async () => {
    try {
      const [contractorsRes, suppliersRes] = await Promise.all([
        api.getContractors({ page: 1, limit: 100 }),
        api.getSuppliers({ page: 1, limit: 100 }),
      ]);
      const mapped = contractorsRes.data.map((c: any) => ({
        ...c,
        status: c.isActive ? 'ACTIVE' : 'INACTIVE',
        nationality: c.taxResidency,
      }));
      setContractors(mapped);
      setSuppliers(suppliersRes.data);
      setError('');

      try {
        const cutoverRes = await api.getWorkforceCutover();
        setGovernancePhase(cutoverRes.governancePhase);
      } catch (cutoverErr) {
        console.warn('Failed to load workforce cutover phase, defaulting to NO_CUTOVER', cutoverErr);
        setGovernancePhase('NO_CUTOVER');
      }
    } catch (err: any) {
      console.error(err);
      setError('Failed to load contractors');
      setContractors([]);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useOperationalTrustChanged((detail) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === detail.supplierId ? { ...s, status: detail.currentState } : s,
      ),
    );
    void loadData();
  });

  const handleOpenModal = (contractor?: Contractor) => {
    setEditingContractor(contractor ?? null);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContractor(null);
  };

  const handleContractorSaved = (saved: Record<string, unknown>, mode: 'create' | 'update') => {
    const mapped = {
      ...(saved as Contractor),
      status: (saved as { isActive?: boolean }).isActive ? 'ACTIVE' : 'INACTIVE',
      nationality: (saved as { taxResidency?: string }).taxResidency,
    };
    if (mode === 'create') {
      setContractors([mapped, ...contractors]);
    } else {
      setContractors(contractors.map((c) => (c.id === mapped.id ? mapped : c)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contractor?')) return;

    try {
      await api.deleteContractor(id);
      setContractors(contractors.filter((c) => c.id !== id));
      showToast('success', 'Contractor deleted successfully');
    } catch (err: any) {
      showToast('error', 'Failed to delete contractor');
    }
  };

  const filteredContractors = contractors.filter((contractor) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${contractor.firstName} ${contractor.lastName}`;
    return (
      fullName.toLowerCase().includes(searchLower) ||
      contractor.email.toLowerCase().includes(searchLower) ||
      contractor.taxNumber?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <RequirePermission permission={PERMISSIONS.CONTRACTORS.READ}>
      <DashboardLayout>
        <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{EXTERNAL_WORKFORCE_LABELS.registry}</h1>
            <p className="text-gray-600 mt-1">
              {canMutateContractors
                ? 'Manage external worker profiles and information'
                : 'Read-only external workforce registry (workforce import and governance scans use connector surfaces)'}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Link href="/contractors/workforce-review" className="btn btn-secondary">
              {EXTERNAL_WORKFORCE_LABELS.workforceReview}
            </Link>
            <button
              onClick={() => exportContractorsToCSV(filteredContractors)}
              className="btn btn-secondary flex items-center"
              disabled={filteredContractors.length === 0}
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
            {can(PERMISSIONS.CONTRACTORS.CREATE) && (
              <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center">
                <Plus className="w-4 h-4 mr-2" />
                {EXTERNAL_WORKFORCE_LABELS.addWorker}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded relative">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {governancePhase && (
          <div
            data-testid="cutover-banner"
            className={
              governancePhase === 'POST_CUTOVER'
                ? 'rounded-md border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-800'
                : governancePhase === 'PRE_CUTOVER'
                ? 'rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900'
                : 'rounded-md border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-800'
            }
            role="status"
          >
            {governancePhase === 'POST_CUTOVER'
              ? 'Post-cutover — operational governance prioritized; bootstrap lineage hidden by default.'
              : governancePhase === 'PRE_CUTOVER'
              ? 'Pre-cutover — bootstrap governance remains active.'
              : 'Bootstrap lineage visible — workforce cutover not declared.'}
          </div>
        )}

        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, email, or tax number..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredContractors.length === 0 ? (
            <div className="text-center py-12">
              <User className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? (
                  'No external workers found matching your search'
                ) : governancePhase === 'POST_CUTOVER' ? (
                  can(PERMISSIONS.CONTRACTORS.CREATE)
                    ? `No external workers yet. Use '${EXTERNAL_WORKFORCE_LABELS.addWorker}' to create governed external workers.`
                    : 'No external workers materialized yet.'
                ) : (
                  'No external workers materialized yet. Run workforce import to bring workers from Oracle HCM.'
                )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Supplier
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Tax Number
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    {canMutateContractors && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredContractors.map((contractor) => (
                    <tr key={contractor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {contractor.firstName} {contractor.lastName}
                        </div>
                        {contractor.idNumber && (
                          <div className="text-sm text-gray-500">ID: {contractor.idNumber}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatSupplierDisplayName(contractor.supplier)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{contractor.email}</div>
                        {contractor.phone && (
                          <div className="text-sm text-gray-500">{contractor.phone}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {contractor.taxNumber || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={contractor.status} />
                      </td>
                      {canMutateContractors && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {can(PERMISSIONS.CONTRACTORS.UPDATE) && (
                            <button
                              onClick={() => handleOpenModal(contractor)}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {can(PERMISSIONS.CONTRACTORS.DELETE) && (
                            <button
                              onClick={() => handleDelete(contractor.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredContractors.length} of {contractors.length} external workers
        </div>
      </div>

      <ContractorFormModal
        isOpen={showModal}
        contractor={editingContractor}
        suppliers={suppliers}
        onClose={handleCloseModal}
        onSaved={handleContractorSaved}
      />
      </DashboardLayout>
    </RequirePermission>
  );
}
