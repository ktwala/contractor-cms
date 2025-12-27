'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard-layout';
import Modal from '@/components/ui/modal';
import FormInput from '@/components/ui/form-input';
import FormSelect from '@/components/ui/form-select';
import FormTextarea from '@/components/ui/form-textarea';
import StatusBadge from '@/components/ui/status-badge';
import { api } from '@/lib/api';
import { useToast } from '@/lib/toast';
import { Plus, Edit, Search, FolderOpen, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';

interface Project {
  id: string;
  name: string;
  code: string;
  description?: string;
  startDate: string;
  endDate?: string;
  budget: number;
  currency: string;
  status: string;
  totalSpent?: number;
  totalHours?: number;
  timesheetCount?: number;
  invoiceCount?: number;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
    startDate: '',
    endDate: '',
    budget: '',
    currency: 'ZAR',
    status: 'ACTIVE',
  });
  const [formErrors, setFormErrors] = useState<any>({});
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await api.getProjects({ page: 1, limit: 100 });
      setProjects(response.data);
    } catch (err: any) {
      showToast('error', 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (project?: Project) => {
    if (project) {
      setEditingProject(project);
      setFormData({
        name: project.name,
        code: project.code,
        description: project.description || '',
        startDate: project.startDate.split('T')[0],
        endDate: project.endDate ? project.endDate.split('T')[0] : '',
        budget: project.budget.toString(),
        currency: project.currency,
        status: project.status,
      });
    } else {
      setEditingProject(null);
      setFormData({
        name: '',
        code: `PRJ-${Date.now()}`,
        description: '',
        startDate: '',
        endDate: '',
        budget: '',
        currency: 'ZAR',
        status: 'ACTIVE',
      });
    }
    setFormErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingProject(null);
    setFormErrors({});
  };

  const validateForm = () => {
    const errors: any = {};
    if (!formData.name) errors.name = 'Project name is required';
    if (!formData.code) errors.code = 'Project code is required';
    if (!formData.startDate) errors.startDate = 'Start date is required';
    if (!formData.budget) errors.budget = 'Budget is required';
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
        budget: parseFloat(formData.budget),
      };

      if (editingProject) {
        const updated = await api.updateProject(editingProject.id, payload);
        setProjects(projects.map((p) => (p.id === updated.id ? updated : p)));
        showToast('success', 'Project updated successfully');
      } else {
        const created = await api.createProject(payload);
        setProjects([created, ...projects]);
        showToast('success', 'Project created successfully');
      }
      handleCloseModal();
    } catch (err: any) {
      showToast('error', err.response?.data?.message || 'Failed to save project');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProjects = projects.filter((project) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      project.name.toLowerCase().includes(searchLower) ||
      project.code.toLowerCase().includes(searchLower)
    );
  });

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const getBudgetUtilization = (project: Project) => {
    if (!project.totalSpent || project.budget === 0) return 0;
    return (project.totalSpent / project.budget) * 100;
  };

  const getBudgetStatus = (utilization: number) => {
    if (utilization >= 100) return 'danger';
    if (utilization >= 80) return 'warning';
    return 'success';
  };

  const getBudgetColor = (utilization: number) => {
    if (utilization >= 100) return 'bg-red-600';
    if (utilization >= 80) return 'bg-yellow-600';
    return 'bg-green-600';
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
            <h1 className="text-2xl font-bold text-gray-900">Projects</h1>
            <p className="text-gray-600 mt-1">Manage projects and track budgets</p>
          </div>
          <button onClick={() => handleOpenModal()} className="btn btn-primary flex items-center">
            <Plus className="w-4 h-4 mr-2" />
            Add Project
          </button>
        </div>

        <div className="card">
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name or code..."
                className="input pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">
                {searchTerm ? 'No projects found matching your search' : 'No projects yet'}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredProjects.map((project) => {
                const utilization = getBudgetUtilization(project);
                const budgetStatus = getBudgetStatus(utilization);

                return (
                  <div
                    key={project.id}
                    className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                          <StatusBadge status={project.status} />
                        </div>
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-sm text-gray-500 font-mono">{project.code}</span>
                          <span className="text-sm text-gray-500">
                            {format(new Date(project.startDate), 'MMM dd, yyyy')}
                            {project.endDate &&
                              ` - ${format(new Date(project.endDate), 'MMM dd, yyyy')}`}
                          </span>
                        </div>
                        {project.description && (
                          <p className="text-sm text-gray-600 mt-2">{project.description}</p>
                        )}
                      </div>
                      <button
                        onClick={() => handleOpenModal(project)}
                        className="text-primary-600 hover:text-primary-900"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Budget</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(project.budget, project.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Spent</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(project.totalSpent || 0, project.currency)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Remaining</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {formatCurrency(
                            project.budget - (project.totalSpent || 0),
                            project.currency
                          )}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Total Hours</p>
                        <p className="text-sm font-semibold text-gray-900">
                          {project.totalHours || 0}h
                        </p>
                      </div>
                    </div>

                    {/* Budget Progress Bar */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Budget Utilization</span>
                        <span
                          className={`font-medium ${
                            utilization >= 100
                              ? 'text-red-600'
                              : utilization >= 80
                              ? 'text-yellow-600'
                              : 'text-green-600'
                          }`}
                        >
                          {utilization.toFixed(1)}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all ${getBudgetColor(
                            utilization
                          )}`}
                          style={{ width: `${Math.min(utilization, 100)}%` }}
                        />
                      </div>
                      {utilization >= 80 && (
                        <div className="flex items-center space-x-1 text-xs">
                          <AlertTriangle
                            className={`w-3 h-3 ${
                              utilization >= 100 ? 'text-red-600' : 'text-yellow-600'
                            }`}
                          />
                          <span
                            className={
                              utilization >= 100 ? 'text-red-600' : 'text-yellow-600'
                            }
                          >
                            {utilization >= 100
                              ? 'Budget exceeded!'
                              : 'Approaching budget limit'}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="mt-4 pt-4 border-t border-gray-200 flex items-center space-x-6 text-xs text-gray-500">
                      <span>{project.timesheetCount || 0} timesheets</span>
                      <span>{project.invoiceCount || 0} invoices</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-sm text-gray-500">
          Showing {filteredProjects.length} of {projects.length} projects
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={handleCloseModal}
        title={editingProject ? 'Edit Project' : 'Add Project'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="Project Name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            error={formErrors.name}
            placeholder="e.g., E-commerce Platform Redesign"
            required
          />

          <FormInput
            label="Project Code"
            value={formData.code}
            onChange={(e) => setFormData({ ...formData, code: e.target.value })}
            error={formErrors.code}
            placeholder="e.g., PRJ-2024-001"
            required
          />

          <FormTextarea
            label="Description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Brief description of the project scope and objectives..."
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

          <div className="grid grid-cols-2 gap-4">
            <FormInput
              label="Budget"
              type="number"
              step="0.01"
              value={formData.budget}
              onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
              error={formErrors.budget}
              placeholder="e.g., 100000"
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
              { value: 'ON_HOLD', label: 'On Hold' },
              { value: 'CANCELLED', label: 'Cancelled' },
            ]}
            required
          />

          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={handleCloseModal} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={submitting} className="btn btn-primary">
              {submitting ? 'Saving...' : editingProject ? 'Update Project' : 'Create Project'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
