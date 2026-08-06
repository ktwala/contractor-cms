import axios from 'axios';
import { api } from '@/lib/api';

const localStorageMock = (function () {
  let store: Record<string, string> = {};
  return {
    getItem(key: string) {
      return store[key] || null;
    },
    setItem(key: string, value: string) {
      store[key] = value.toString();
    },
    clear() {
      store = {};
    },
    removeItem(key: string) {
      delete store[key];
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('ApiClient Org Context Injection', () => {
  let requestInterceptor: any;

  beforeEach(() => {
    window.localStorage.clear();
    // Extract the request interceptor from the api client
    // @ts-ignore
    requestInterceptor = api.client.interceptors.request.handlers[0].fulfilled;
  });

  it('preserves query parameters (like page and limit) but DOES NOT inject organizationId for org-scoped endpoints', async () => {
    window.localStorage.setItem('auth_token', 'fake-token');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'finance1',
      organizationId: 'org-123'
    }));

    const initialConfig = {
      url: '/invoices',
      method: 'get',
      headers: {} as Record<string, string>,
      params: {
        page: '1',
        limit: '100',
        status: 'PENDING'
      } as Record<string, string>,
    };

    const finalConfig = await requestInterceptor(initialConfig);

    // Existing params should remain completely untouched
    expect(finalConfig.params.page).toBe('1');
    expect(finalConfig.params.limit).toBe('100');
    expect(finalConfig.params.status).toBe('PENDING');

    // The frontend must never inject organizationId, backend derives from session
    expect(finalConfig.params.organizationId).toBeUndefined();
    expect(finalConfig.headers['X-Organization-Id']).toBeUndefined();
  });

  it('does NOT inject organizationId for global endpoints', async () => {
    window.localStorage.setItem('auth_token', 'fake-token');
    window.localStorage.setItem('user', JSON.stringify({
      id: 'finance1',
      organizationId: 'org-123'
    }));

    const initialConfig = {
      url: '/audit/insights',
      method: 'get',
      headers: {} as Record<string, string>,
      params: {
        startDate: '2023-01-01'
      } as Record<string, string>,
    };

    const finalConfig = await requestInterceptor(initialConfig);

    expect(finalConfig.params.startDate).toBe('2023-01-01');
    expect(finalConfig.params.organizationId).toBeUndefined();
  });
});
