import fs from 'fs';
import path from 'path';
import {
  canCreateSupplierMaster,
  supplierPortalProfileTitle,
} from '@/lib/tenant-authority';

const repoRoot = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(repoRoot, rel), 'utf8');
}

describe('authority-ui-drift (PR-CMS-GOV-1E)', () => {
  it('tenant-authority exposes Oracle portal compliance headline', () => {
    expect(
      supplierPortalProfileTitle({ supplierAuthorityMode: 'ORACLE_ONLY', contractorAuthorityMode: 'HYBRID' }),
    ).toBe('Complete compliance profile');
    expect(canCreateSupplierMaster({ supplierAuthorityMode: 'ORACLE_ONLY', contractorAuthorityMode: 'HYBRID' })).toBe(false);
  });

  it('client suppliers page gates create with canCreateSupplierMaster', () => {
    const page = read('frontend/app/suppliers/page.tsx');
    expect(page).toMatch(/canCreateSupplierMaster/);
    expect(page).toMatch(/supplierMasterCreateLabel/);
    expect(page).toMatch(/showCreateSupplier/);
    expect(page).not.toMatch(/>\s*Add Supplier\s*</);
  });

  it('supplier portal profile uses tenant-aware title', () => {
    const page = read('frontend/app/supplier-portal/profile/page.tsx');
    expect(page).toMatch(/supplierPortalProfileTitle/);
    expect(page).toMatch(/supplierPortalProfileDescription/);
  });

  it('suppliers page renders governance dashboard for Oracle tenants', () => {
    const page = read('frontend/app/suppliers/page.tsx');
    expect(page).toMatch(/SupplierGovernanceDashboard/);
    expect(page).toMatch(/showGovernanceDashboard/);
  });
});
