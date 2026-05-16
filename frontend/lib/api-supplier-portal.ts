import { api } from './api';

/** PR-SUPPLIER-PORTAL-UI-1 — thin facade over membership-scoped portal endpoints. */
export const supplierPortalApi = {
  getProfile: () => api.getSupplierPortalProfile(),
  updateProfile: (data: Record<string, unknown>) => api.updateSupplierPortalProfile(data),
  getResources: (params?: { page?: number; limit?: number }) =>
    api.getSupplierPortalResources(params),
  createResource: (data: Record<string, unknown>) => api.createSupplierPortalResource(data),
  getTimesheets: (params?: Record<string, unknown>) => api.getSupplierPortalTimesheets(params),
};
