import { validateSupplierForm } from '@/components/suppliers/SupplierFormModal';

describe('validateSupplierForm', () => {
  const base = {
    type: 'COMPANY' as const,
    companyName: 'Acme Ltd',
    firstName: '',
    lastName: '',
    email: 'ops@acme.test',
    phone: '',
    status: 'ACTIVE',
    country: 'ZA',
  };

  it('requires company name for COMPANY type', () => {
    const errors = validateSupplierForm({ ...base, companyName: '' });
    expect(errors.companyName).toBeDefined();
  });

  it('requires first and last name for INDIVIDUAL type', () => {
    const errors = validateSupplierForm({
      ...base,
      type: 'INDIVIDUAL',
      companyName: '',
      firstName: '',
      lastName: 'Doe',
    });
    expect(errors.firstName).toBeDefined();
  });

  it('requires valid email', () => {
    const errors = validateSupplierForm({ ...base, email: 'not-an-email' });
    expect(errors.email).toBeDefined();
  });
});
