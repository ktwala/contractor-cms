import api from './api';

/** Supplier portal API — membership-scoped; not client /suppliers or /contractors. */
export const supplierPortalApi = {
  getProfile: () => api.getSupplierPortalProfile(),
  updateProfile: (data: Record<string, unknown>) => api.updateSupplierPortalProfile(data),
  getContractors: (params?: { page?: number; limit?: number }) =>
    api.getSupplierPortalContractors(params),
  createContractor: (data: Record<string, unknown>) => api.createSupplierPortalContractor(data),
  getTimesheets: (params?: Record<string, unknown>) => api.getSupplierPortalTimesheets(params),
};
