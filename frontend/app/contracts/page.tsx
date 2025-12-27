'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Edit, Trash2, Search, FileText } from 'lucide-react';
import { format } from 'date-fns';

interface Contract {
  id: string;
  contractNumber: string;
  title: string;
  type: string;
  startDate: string;
  endDate?: string;
  rate: number;
  rateType: string;
  currency: string;
  status: string;
  contractorId: string;
  supplierId: string;
  contractor?: {
    firstName: string;
    lastName: string;
  };
  supplier?: {
    firstName?: string;
    lastName?: string;
    companyName?: string;
  };
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [contractors, setContractors] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingContract, setEditingContract] = useState<Contract | null>(null);
  const [formData, setFormData] = useState({
    contractorId: '',
    supplierId: '',
    contractNumber: '',
    title: '',
    type: 'FIXED_TERM',
    startDate: '',
    endDate: '',
    rate: '',
    rateType: 'HOURLY',
    currency: 'ZAR',
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
      const [contractsRes, contractorsRes, suppliersRes] = await Promise.all([
        api.getContracts({ page: 1, limit: 100 }),
        api.getContractors({ page: 1, limit: 100 }),
        api.getSuppliers({ page: 1, limit: 100 }),
      ]);
      setContracts(contractsRes.data);
      setContractors(contractorsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (err: any) {
      showToast('error', 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (contract?: Contract) => {
    if (contract) {
      setEditingContract(contract);
      setFormData({
        contractorId: contract.contractorId,
        supplierId: contract.supplierId,
        contractNumber: contract.contractNumber,
        title: contract.title,
        type: contract.type,
        startDate: contract.startDate.split('T')[0],
        endDate: contract.endDate ? contract.endDate.split('T')[0] : '',
        rate: contract.rate.toString(),
        rateType: contract.rateType,
        currency: contract.currency,
        status: contract.status,
      });
    } else {
      setEditingContract(null);
      setFormData({
        contractorId: '',
        supplierId: '',
        contractNumber: `CT-${Date.now()}`,
        title: '',
        type: 'FIXED_TERM',
        startDate: '',
        endDate: '',
        rate: '',
        rateType: 'HOURLY',
        currency: 'ZAR',
        status: 'ACTIVE',
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingContract(null);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.contractorId) errors.contractorId = 'Contractor is required';
    if (!formData.supplierId) errors.supplierId = 'Supplier is required';
    if (!formData.contractNumber) errors.contractNumber = 'Contract number is required';
    if (!formData.title) errors.title = 'Title is required';
    if (!formData.startDate) errors.startDate = 'Start date is required';
    if (!formData.rate) errors.rate = 'Rate is required';
    if (formData.endDate && formData.endDate <= formData.startDate) {
      errors.endDate = 'End date must be after start date';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        rate: parseFloat(formData.rate),
      };

      if (editingContract) {
        const updated = await api.updateContract(editingContract.id, payload);
        setContracts(contracts.map((c) => (c.id === updated.id ? updated : c)));
        showToast('success', 'Contract updated successfully');
      } else {
        const created = await api.createContract(payload);
        setContracts([created, ...contracts]);
        showToast('success', 'Contract created successfully');
      }
      handleCloseModal();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save contract');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contract?')) return;

    try {
      await api.deleteContract(id);
      setContracts(contracts.filter((c) => c.id !== id));
      showToast('success', 'Contract deleted successfully');
    } catch (err: any) {
      showToast('error', 'Failed to delete contract');
    }
  };

  const filteredContracts = contracts.filter((contract) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      contract.contractNumber.toLowerCase().includes(searchLower) ||
      contract.title.toLowerCase().includes(searchLower) ||
      (contract.contractor &&
        `${contract.contractor.firstName} ${contract.contractor.lastName}`
          .toLowerCase()
          .includes(searchLower))
    );
  });

  const getSupplierName = (supplier: any) => {
    if (!supplier) return '-';
    if (supplier.companyName) return supplier.companyName;
    return `${supplier.firstName} ${supplier.lastName}`;
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
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
            <h1 className="text-2xl font-bold text-gray-900">Contracts</h1>
            <p className="text-gray-600 mt-1">Manage contractor agreements and terms</p>
          </div>
          <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Contract
          </button>
        </div>

        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by contract number, title, or contractor..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredContracts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No contracts found matching your search' : 'No contracts yet'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contract
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contractor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Period
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Rate
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
                  {filteredContracts.map((contract) => (
                    <tr key={contract.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {contract.contractNumber}
                        </div>
                        <div className="text-sm text-gray-500">{contract.title}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contract.contractor && (
                          <div className="text-sm text-gray-900">
                            {contract.contractor.firstName} {contract.contractor.lastName}
                          </div>
                        )}
                        <div className="text-sm text-gray-500">{getSupplierName(contract.supplier)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-xs px-2 py-1 bg-gray-100 text-gray-800 rounded">
                          {contract.type.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div>{format(new Date(contract.startDate), 'MMM dd, yyyy')}</div>
                        {contract.endDate && (
                          <div className="text-xs text-gray-400">
                            to {format(new Date(contract.endDate), 'MMM dd, yyyy')}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(contract.rate, contract.currency)}
                        </div>
                        <div className="text-xs text-gray-500">{contract.rateType}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={contract.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleOpenModal(contract)}
                          className="text-primary-600 hover:text-primary-900 mr-4"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contract.id)}
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
          Showing {filteredContracts.length} of {contracts.length} contracts
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingContract ? 'Edit Contract' : 'Add Contract'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Contract Number"
            value={formData.contractNumber}
            onChange={(e) => setFormData({ ...formData, contractNumber: e.target.value })}
            error={formErrors.contractNumber}
            required
          />

          <FormInput
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            error={formErrors.title}
            placeholder="e.g., Software Development Contract"
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <FormSelect
              label="Contractor"
              value={formData.contractorId}
              onChange={(e) => setFormData({ ...formData, contractorId: e.target.value })}
              options={contractors.map((c) => ({
                value: c.id,
                label: `${c.firstName} ${c.lastName}`,
              }))}
              error={formErrors.contractorId}
              required
            />
            <FormSelect
              label="Supplier"
              value={formData.supplierId}
              onChange={(e) => setFormData({ ...formData, supplierId: e.target.value })}
              options={suppliers.map((s) => ({
                value: s.id,
                label:
                  s.type === 'COMPANY'
                    ? s.companyName
                    : `${s.firstName} ${s.lastName}`,
              }))}
              error={formErrors.supplierId}
              required
            />
          </div>

          <FormSelect
            label="Contract Type"
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
            options={[
              { value: 'FIXED_TERM', label: 'Fixed Term' },
              { value: 'INDEFINITE', label: 'Indefinite' },
              { value: 'PROJECT_BASED', label: 'Project Based' },
            ]}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Start Date"
              type="date"
              value={formData.startDate}
              onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
              error={formErrors.startDate}
              required
            />
            <FormInput
              label="End Date"
              type="date"
              value={formData.endDate}
              onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
              error={formErrors.endDate}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormInput
              label="Rate"
              type="number"
              step="0.01"
              value={formData.rate}
              onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
              error={formErrors.rate}
              required
            />
            <FormSelect
              label="Rate Type"
              value={formData.rateType}
              onChange={(e) => setFormData({ ...formData, rateType: e.target.value })}
              options={[
                { value: 'HOURLY', label: 'Hourly' },
                { value: 'DAILY', label: 'Daily' },
                { value: 'MONTHLY', label: 'Monthly' },
                { value: 'FIXED', label: 'Fixed' },
              ]}
              required
            />
            <FormInput
              label="Currency"
              value={formData.currency}
              onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
              placeholder="ZAR"
              required
            />
          </div>

          <FormSelect
            label="Status"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'COMPLETED', label: 'Completed' },
              { value: 'TERMINATED', label: 'Terminated' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Saving...' : editingContract ? 'Update Contract' : 'Create Contract'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
