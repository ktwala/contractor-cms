import { isAxiosError } from 'axios';
import {
  SUPPLIER_MEMBERSHIP_REQUIRED_CODE,
  SUPPLIER_NOT_LINKED_MESSAGE,
} from './supplier-portal-context';

/** Map supplier-portal API failures to user-facing copy (PR-SUPPLIER-PORTAL-DATA-1). */
export function getSupplierPortalErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (!isAxiosError(err)) {
    return fallback;
  }

  const status = err.response?.status;
  const data = err.response?.data as {
    message?: string | string[];
    code?: string;
  };
  const message = data?.message ?? '';
  const text = Array.isArray(message) ? message.join(', ') : String(message);

  if (status === 403) {
    if (
      data?.code === SUPPLIER_MEMBERSHIP_REQUIRED_CODE ||
      text.toLowerCase().includes('supplier membership')
    ) {
      return SUPPLIER_NOT_LINKED_MESSAGE;
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

/** True only for transport/server failures — not empty data envelopes. */
export function isSupplierPortalLoadFailure(err: unknown): boolean {
  if (!isAxiosError(err)) return true;
  const status = err.response?.status;
  if (!status) return true;
  return status >= 500 || status === 401;
}
