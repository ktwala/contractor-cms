import { isAxiosError } from 'axios';

/** Map supplier-portal API failures to user-facing copy (PR-SUPPLIER-PORTAL-HYDRATION-FIX-1). */
export function getSupplierPortalErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (!isAxiosError(err)) {
    return fallback;
  }

  const status = err.response?.status;
  const message =
    (err.response?.data as { message?: string | string[] })?.message ?? '';

  const text = Array.isArray(message) ? message.join(', ') : String(message);

  if (status === 403) {
    if (text.includes('supplier membership')) {
      return 'Supplier membership required. Sign in with a supplier portal account or contact your administrator.';
    }
    return text || 'You do not have permission to access this supplier portal resource.';
  }

  if (status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (status === 404) {
    return text || 'Supplier record not found for your membership.';
  }

  if (status && status >= 500) {
    return 'The server could not load supplier data. Try again or contact support.';
  }

  if (text) {
    return text;
  }

  if (err.code === 'ERR_NETWORK') {
    return 'Cannot reach the API. Check that the backend is running and NEXT_PUBLIC_API_URL is correct.';
  }

  return fallback;
}
