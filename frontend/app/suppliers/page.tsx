'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/dashboard-layout';
import { api } from '@/lib/api';
import Link from 'next/link';
import { Plus, Edit, Trash2, Search, ExternalLink } from 'lucide-react';
import RequirePermission from '@/components/RequirePermission';
import { PERMISSIONS } from '@/lib/permissions.generated';
import { useAuth } from '@/lib/auth-context';
import SupplierFormModal from '@/components/suppliers/SupplierFormModal';
import { formatSupplierDisplayName } from '@/lib/supplier-display';
import SupplierGovernanceDashboard from '@/components/suppliers/SupplierGovernanceDashboard';
import { SUPPLIER_GOVERNANCE_BUCKET_FILTER_LABELS } from '@/lib/supplier-governance-navigation';
import {
  canCreateSupplierMaster,
  isOracleSupplierAuthority,
  supplierMasterCreateLabel,
} from '@/lib/tenant-authority';
import {
  OPERATIONAL_TRUST_LABELS,
  oracleProcurementLabel,
  operationalTrustLabel,
  operationalTrustBadgeClass,
} from '@/lib/operational-trust-labels';
import { useOperationalTrustChanged } from '@/lib/operational-trust-events';

interface Supplier {
  id: string;
  type: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  tradingName?: string;
  email: string;
  phone?: string;
  status: string;
  taxNumber?: string;
  externalSupplierId?: string | null;
}

export default function SuppliersPage() {
  const searchParams = useSearchParams();
  const governanceBucket = searchParams.get('governanceBucket');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalSupplierId, setModalSupplierId] = useState<string | null>(null);
  const { can, user } = useAuth();
  const showCreateSupplier =
    can(PERMISSIONS.SUPPLIERS.CREATE) &&
    canCreateSupplierMaster(user?.tenantAuthority);
  const showGovernanceDashboard =
    user?.tenantAuthority?.supplierAuthorityMode === 'HYBRID' ||
    isOracleSupplierAuthority(user?.tenantAuthority);

  const loadSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.getSuppliers({
        page: 1,
        limit: 100,
        ...(governanceBucket ? { governanceBucket } : {}),
      });
      setSuppliers(response.data);
      setError('');
    } catch {
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [governanceBucket]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  useOperationalTrustChanged((detail) => {
    setSuppliers((prev) =>
      prev.map((s) =>
        s.id === detail.supplierId ? { ...s, status: detail.currentState } : s,
      ),
    );
    void loadSuppliers();
  });

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;

    try {
      await api.deleteSupplier(id);
      setSuppliers(suppliers.filter((s) => s.id !== id));
    } catch (err: any) {
      alert('Failed to delete supplier');
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    const searchLower = searchTerm.toLowerCase();
    const name =
      supplier.type === 'COMPANY'
        ? supplier.companyName || ''
        : `${supplier.firstName} ${supplier.lastName}`;
    return (
      name.toLowerCase().includes(searchLower) ||
      supplier.email.toLowerCase().includes(searchLower)
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
    <RequirePermission permission={PERMISSIONS.SUPPLIERS.READ}>
      <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-gray-600 mt-1">
              {user?.tenantAuthority?.supplierAuthorityMode === 'ORACLE_ONLY'
                ? 'Oracle-approved supplier inventory — Operational Trust managed in EWP'
                : 'Manage your supplier network'}
            </p>
          </div>
          {showCreateSupplier && (
            <button
              onClick={() => {
                setModalSupplierId(null);
                setShowModal(true);
              }}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              {supplierMasterCreateLabel(user?.tenantAuthority)}
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {showGovernanceDashboard && (
          <SupplierGovernanceDashboard className="card p-4" />
        )}

        {governanceBucket && (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-800 px-3 py-1 font-medium">
              Filter:{' '}
              {SUPPLIER_GOVERNANCE_BUCKET_FILTER_LABELS[governanceBucket] ??
                governanceBucket}
            </span>
            <Link href="/suppliers" className="text-indigo-600 hover:text-indigo-800">
              Clear filter
            </Link>
            {governanceBucket === 'pending_evidence' && (
              <Link
                href="/suppliers/approvals"
                className="text-indigo-600 hover:text-indigo-800"
              >
                Open operational trust queue →
              </Link>
            )}
          </div>
        )}

        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search suppliers by name or email..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredSuppliers.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              {searchTerm ? 'No suppliers found matching your search' : 'No suppliers yet'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    {showGovernanceDashboard ? (
                      <>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {OPERATIONAL_TRUST_LABELS.oracleColumn}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {OPERATIONAL_TRUST_LABELS.operationalTrustColumn}
                        </th>
                      </>
                    ) : (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSuppliers.map((supplier) => {
                    const name = formatSupplierDisplayName(supplier);

                    return (
                      <tr key={supplier.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{name}</div>
                          {supplier.taxNumber && (
                            <div className="text-sm text-gray-500">Tax: {supplier.taxNumber}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {supplier.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supplier.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {supplier.phone || '-'}
                        </td>
                        {showGovernanceDashboard ? (
                          <>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                {oracleProcurementLabel(supplier.externalSupplierId)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span
                                className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${operationalTrustBadgeClass(supplier.status)}`}
                              >
                                {operationalTrustLabel(supplier.status)}
                              </span>
                            </td>
                          </>
                        ) : (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                supplier.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {supplier.status}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <Link
                            href={`/suppliers/${supplier.id}`}
                            className="text-gray-600 hover:text-gray-900 mr-4 inline-flex"
                            title="View supplier"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Link>
                          {can(PERMISSIONS.SUPPLIERS.UPDATE) && (
                            <button
                              onClick={() => {
                                setModalSupplierId(supplier.id);
                                setShowModal(true);
                              }}
                              className="text-primary-600 hover:text-primary-900 mr-4"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          )}
                          {can(PERMISSIONS.SUPPLIERS.DELETE) && (
                            <button
                              onClick={() => handleDelete(supplier.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredSuppliers.length} of {suppliers.length} suppliers
        </div>
      </div>

      <SupplierFormModal
        isOpen={showModal}
        supplierId={modalSupplierId}
        onClose={() => {
          setShowModal(false);
          setModalSupplierId(null);
        }}
        onSaved={(saved) => {
          const row = saved as unknown as Supplier;
          setSuppliers((prev) => {
            const idx = prev.findIndex((s) => s.id === row.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...next[idx], ...row };
              return next;
            }
            return [row, ...prev];
          });
          void loadSuppliers();
        }}
      />
      </DashboardLayout>
    </RequirePermission>
  );
}
