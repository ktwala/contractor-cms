'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Edit, Trash2, Search, User } from 'lucide-react';

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
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
}

interface Supplier {
  id: string;
  type: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContractor, setEditingContractor] = useState<Contractor | null>(null);
  const [formData, setFormData] = useState({
    supplierId: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    taxNumber: '',
    idNumber: '',
    dateOfBirth: '',
    nationality: 'ZA',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [contractorsRes, suppliersRes] = await Promise.all([
        api.getContractors({ page: 1, limit: 100 }),
        api.getSuppliers({ page: 1, limit: 100 }),
      ]);
      setContractors(contractorsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (err: any) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (contractor?: Contractor) => {
    if (contractor) {
      setEditingContractor(contractor);
      setFormData({
        supplierId: contractor.supplierId,
        firstName: contractor.firstName,
        lastName: contractor.lastName,
        email: contractor.email,
        phone: contractor.phone || '',
        taxNumber: contractor.taxNumber || '',
        idNumber: contractor.idNumber || '',
        dateOfBirth: contractor.dateOfBirth || '',
        nationality: contractor.nationality || 'ZA',
        status: contractor.status,
      });
    } else {
      setEditingContractor(null);
      setFormData({
        supplierId: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        taxNumber: '',
        idNumber: '',
        dateOfBirth: '',
        nationality: 'ZA',
        status: 'ACTIVE',
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContractor(null);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.supplierId) errors.supplierId = 'Supplier is required';
    if (!formData.firstName) errors.firstName = 'First name is required';
    if (!formData.lastName) errors.lastName = 'Last name is required';
    if (!formData.email) errors.email = 'Email is required';
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = 'Email is invalid';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      if (editingContractor) {
        const updated = await api.updateContractor(editingContractor.id, formData);
        setContractors(contractors.map((c) => (c.id === updated.id ? updated : c)));
        showToast('success', 'Contractor updated successfully');
      } else {
        const created = await api.createContractor(formData);
        setContractors([created, ...contractors]);
        showToast('success', 'Contractor created successfully');
      }
      handleCloseModal();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save contractor');
    } finally {
      setSubmitting(false);
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

  const getSupplierName = (supplier: Supplier) => {
    if (supplier.type === 'COMPANY') return supplier.companyName;
    return `${supplier.firstName} ${supplier.lastName}`;
  };

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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Contractors</h1>
            <p className="text-gray-600 mt-1">Manage contractor profiles and information</p>
          </div>
          <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Contractor
          </button>
        </div>

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
                {searchTerm ? 'No contractors found matching your search' : 'No contractors yet'}
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
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
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
                        {contractor.supplier && getSupplierName(contractor.supplier)}
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(contractor)}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contractor.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredContractors.length} of {contractors.length} contractors
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingContractor ? 'Edit Contractor' : 'Add Contractor'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormSelect
            label="Supplier"
            value={formData.supplierId}
            onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
            options={suppliers.map((s) => ({
              value: s.id,
              label: getSupplierName(s),
            }))}
            error={formErrors.supplierId}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="First Name"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              error={formErrors.firstName}
              required
            />
            <FormInput
              label="Last Name"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
              error={formErrors.lastName}
              required
            />
          </div>

          <FormInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            error={formErrors.email}
            required
          />

          <FormInput
            label="Phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
            placeholder="+27821234567"
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Tax Number"
              value={formData.taxNumber}
              onChange={(e) => setFormData({ ...formData, taxNumber: e.target.value })}
            />
            <FormInput
              label="ID Number"
              value={formData.idNumber}
              onChange={(e) => setFormData({ ...formData, idNumber: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Date of Birth"
              type="date"
              value={formData.dateOfBirth}
              onChange={(e) => setFormData({ ...formData, dateOfBirth: e.target.value })}
            />
            <FormInput
              label="Nationality"
              value={formData.nationality}
              onChange={(e) => setFormData({ ...formData, nationality: e.target.value })}
              placeholder="ZA"
            />
          </div>

          <FormSelect
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
            ]}
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting
                ? 'Saving...'
                : editingContractor
                ? 'Update Contractor'
                : 'Create Contractor'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
