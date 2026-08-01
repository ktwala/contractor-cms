import { api } from './api';

/** Supplier portal API — membership-scoped; not client /suppliers or /contractors. */
export const supplierPortalApi = {
  getProfile: () => api.getSupplierPortalProfile(),
  updateProfile: (data: Record<string, unknown>) => api.updateSupplierPortalProfile(data),
  getEvidenceChecklist: () => api.getSupplierPortalEvidenceChecklist(),
  submitForApproval: () => api.submitSupplierPortalForApproval(),
  createDocument: (data: Record<string, unknown>) => api.createSupplierPortalDocument(data),
  getContractors: (params?: { page?: number; limit?: number }) =>
    api.getSupplierPortalContractors(params),
  getContractor: (id: string) => api.getSupplierPortalContractor(id),
  getContractorWorkforceHistory: (id: string) =>
    api.getSupplierPortalContractorWorkforceHistory(id),
  getContracts: () => api.getSupplierPortalContracts(),
  createContractor: (data: Record<string, unknown>) => api.createSupplierPortalContractor(data),
  getTimesheets: (params?: Record<string, unknown>) => api.getSupplierPortalTimesheets(params),
  getInvoices: (params?: Record<string, unknown>) => api.getSupplierPortalInvoices(params),
  getDashboard: () => api.getSupplierPortalDashboard(),
};
