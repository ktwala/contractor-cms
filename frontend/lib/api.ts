import axios, { AxiosInstance } from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add token to requests
    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('auth_token');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Handle 401 errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem('auth_token');
            localStorage.removeItem('user');
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth
  async register(data: any) {
    const response = await this.client.post('/auth/register', data);
    return response.data;
  }

  async login(email: string, password: string) {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async getProfile() {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  // Suppliers
  async getSuppliers(params?: any) {
    const response = await this.client.get('/suppliers', { params });
    return response.data;
  }

  async getSupplier(id: string) {
    const response = await this.client.get(`/suppliers/${id}`);
    return response.data;
  }

  async createSupplier(data: any) {
    const response = await this.client.post('/suppliers', data);
    return response.data;
  }

  async updateSupplier(id: string, data: any) {
    const response = await this.client.patch(`/suppliers/${id}`, data);
    return response.data;
  }

  async deleteSupplier(id: string) {
    await this.client.delete(`/suppliers/${id}`);
  }

  // Contractors
  async getContractors(params?: any) {
    const response = await this.client.get('/contractors', { params });
    return response.data;
  }

  async getContractor(id: string) {
    const response = await this.client.get(`/contractors/${id}`);
    return response.data;
  }

  async createContractor(data: any) {
    const response = await this.client.post('/contractors', data);
    return response.data;
  }

  async updateContractor(id: string, data: any) {
    const response = await this.client.patch(`/contractors/${id}`, data);
    return response.data;
  }

  async deleteContractor(id: string) {
    await this.client.delete(`/contractors/${id}`);
  }

  // Contracts
  async getContracts(params?: any) {
    const response = await this.client.get('/contracts', { params });
    return response.data;
  }

  async createContract(data: any) {
    const response = await this.client.post('/contracts', data);
    return response.data;
  }

  async updateContract(id: string, data: any) {
    const response = await this.client.patch(`/contracts/${id}`, data);
    return response.data;
  }

  // Engagements
  async getEngagements(params?: any) {
    const response = await this.client.get('/engagements', { params });
    return response.data;
  }

  async createEngagement(data: any) {
    const response = await this.client.post('/engagements', data);
    return response.data;
  }

  async updateEngagement(id: string, data: any) {
    const response = await this.client.patch(`/engagements/${id}`, data);
    return response.data;
  }

  // Timesheets
  async getTimesheets(params?: any) {
    const response = await this.client.get('/timesheets', { params });
    return response.data;
  }

  async createTimesheet(data: any) {
    const response = await this.client.post('/timesheets', data);
    return response.data;
  }

  async updateTimesheet(id: string, data: any) {
    const response = await this.client.patch(`/timesheets/${id}`, data);
    return response.data;
  }

  async submitTimesheet(id: string) {
    const response = await this.client.patch(`/timesheets/${id}/submit`);
    return response.data;
  }

  async approveTimesheet(id: string) {
    const response = await this.client.patch(`/timesheets/${id}/approve`);
    return response.data;
  }

  async rejectTimesheet(id: string, reason: string) {
    const response = await this.client.patch(`/timesheets/${id}/reject`, { reason });
    return response.data;
  }

  // Invoices
  async getInvoices(params?: any) {
    const response = await this.client.get('/invoices', { params });
    return response.data;
  }

  async createInvoice(data: any) {
    const response = await this.client.post('/invoices', data);
    return response.data;
  }

  async markInvoicePaid(id: string, data: any) {
    const response = await this.client.patch(`/invoices/${id}/mark-paid`, data);
    return response.data;
  }

  // Projects
  async getProjects(params?: any) {
    const response = await this.client.get('/projects', { params });
    return response.data;
  }

  async getProject(id: string) {
    const response = await this.client.get(`/projects/${id}`);
    return response.data;
  }

  async createProject(data: any) {
    const response = await this.client.post('/projects', data);
    return response.data;
  }

  async updateProject(id: string, data: any) {
    const response = await this.client.patch(`/projects/${id}`, data);
    return response.data;
  }

  async getProjectBudgetUtilization(id: string) {
    const response = await this.client.get(`/projects/${id}/budget-utilization`);
    return response.data;
  }

  // Analytics
  async getDashboardAnalytics(params?: any) {
    const response = await this.client.get('/analytics/dashboard', { params });
    return response.data;
  }

  async getFinancialAnalytics(params?: any) {
    const response = await this.client.get('/analytics/financial', { params });
    return response.data;
  }

  async getContractorAnalytics() {
    const response = await this.client.get('/analytics/contractors');
    return response.data;
  }

  async getProjectAnalytics() {
    const response = await this.client.get('/analytics/projects');
    return response.data;
  }
}

export const api = new ApiClient();
