import axios from 'axios';

// Resolve API base URL: use env if set, else /v1 (proxied by Vite dev server to backend).
// When using a full URL (e.g. Docker), ensure it ends with /v1 for NestJS global prefix.
function resolveBaseURL(): string {
  const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '/v1';
  if (typeof raw !== 'string' || !raw) return '/v1';
  if (raw.startsWith('http') && !raw.endsWith('/v1') && !raw.endsWith('/v1/')) {
    return raw.replace(/\/$/, '') + '/v1';
  }
  return raw;
}

const api = axios.create({
  baseURL: resolveBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('token');
      localStorage.removeItem('role');
      localStorage.removeItem('admin_permissions');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
