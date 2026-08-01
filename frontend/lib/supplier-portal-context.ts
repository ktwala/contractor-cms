import { isAxiosError } from 'axios';

export const SUPPLIER_MEMBERSHIP_REQUIRED_CODE = 'SUPPLIER_MEMBERSHIP_REQUIRED';

/** Access warning when supplier membership is missing (PR-SUPPLIER-PORTAL-DATA-1). */
export const SUPPLIER_NOT_LINKED_TITLE = 'No supplier linked';

export const SUPPLIER_NOT_LINKED_MESSAGE =
  'No supplier is linked to your account. Operations must assign supplier portal membership after synchronization and governance promotion — contact your administrator.';

export function isSupplierMembershipError(err: unknown): boolean {
  if (!isAxiosError(err)) return false;
  const data = err.response?.data as { code?: string; message?: string | string[] } | undefined;
  if (data?.code === SUPPLIER_MEMBERSHIP_REQUIRED_CODE) {
    return true;
  }
  const message = data?.message ?? '';
  const text = Array.isArray(message) ? message.join(', ') : String(message);
  return (
    err.response?.status === 403 &&
    text.toLowerCase().includes('supplier membership')
  );
}
