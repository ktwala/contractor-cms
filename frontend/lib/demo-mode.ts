/** PR-DEMO-CONNECTOR-1 — gate connector demo action buttons. */
export function isConnectorDemoUiEnabled(): boolean {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === 'true') {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
}

export const DEMO_CLEAN_SUPPLIER_EXTERNAL_ID = 'ORCL-SUP-MTN-001';
export const DEMO_SUPPLIER_ADMIN_EMAIL = 'supplier.admin@atlas.demo';
