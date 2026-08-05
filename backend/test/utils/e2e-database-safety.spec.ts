import { assertSafeE2eDatabaseTarget } from './test-helper';

describe('E2E Database Safety Guard', () => {
  const E2E_URL = 'postgresql://contractor_cms:password@localhost:5433/contractor_cms_e2e';
  const DEV_URL = 'postgresql://contractor_cms:password@localhost:5433/contractor_cms';

  it('allows test + contractor_cms_e2e', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(E2E_URL, 'test'),
    ).not.toThrow();
  });

  it('rejects test + contractor_cms (development database)', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(DEV_URL, 'test'),
    ).toThrow('E2E_DATABASE_SAFETY: refusing cleanup for database "contractor_cms"');
  });

  it('rejects development + contractor_cms_e2e', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(E2E_URL, 'development'),
    ).toThrow('E2E_DATABASE_SAFETY: refusing cleanup for database "contractor_cms_e2e"');
  });

  it('rejects missing DATABASE_URL', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(undefined, 'test'),
    ).toThrow('E2E_DATABASE_SAFETY: DATABASE_URL is required before database cleanup');
  });

  it('rejects missing NODE_ENV', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(E2E_URL, undefined),
    ).toThrow('E2E_DATABASE_SAFETY: refusing cleanup');
  });

  it('rejects invalid URL', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget('not-a-url', 'test'),
    ).toThrow('E2E_DATABASE_SAFETY: DATABASE_URL is not a valid URL');
  });
});
