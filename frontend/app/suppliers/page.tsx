'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import { api } from '@/lib/api';
import { Plus, Edit, Trash2, Search } from 'lucide-react';

interface Supplier {
  id: string;
  type: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  email: string;
  phone?: string;
  status: string;
  taxNumber?: string;
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  useEffect(() => {
    loadSuppliers();
  }, []);

  const loadSuppliers = async () => {
    try {
      const response = await api.getSuppliers({ page: 1, limit: 100 });
      setSuppliers(response.data);
    } catch (err: any) {
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

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
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Suppliers</h1>
            <p className="text-gray-600 mt-1">Manage your supplier network</p>
          </div>
          <button
            onClick={() => {
              setEditingSupplier(null);
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Supplier
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredSuppliers.map((supplier) => {
                    const name =
                      supplier.type === 'COMPANY'
                        ? supplier.companyName
                        : `${supplier.firstName} ${supplier.lastName}`;

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
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              setEditingSupplier(supplier);
                              setShowModal(true);
                            }}
                            className="text-primary-600 hover:text-primary-900 mr-4"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(supplier.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Modal Placeholder */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium mb-4">
              {editingSupplier ? 'Edit Supplier' : 'Add Supplier'}
            </h3>
            <p className="text-gray-600 mb-4">
              Supplier form would go here. Use react-hook-form for full implementation.
            </p>
            <div className="flex justify-end space-x-2">
              <button onClick={() => setShowModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={() => setShowModal(false)} className="btn btn-primary">
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
