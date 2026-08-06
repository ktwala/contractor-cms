import { assertSafeE2eDatabaseTarget } from './test-helper';

describe('E2E Database Safety Guard', () => {
  const E2E_URL = 'postgresql://external_workforce_platform:password@localhost:5433/external_workforce_platform_e2e';
  const DEV_URL = 'postgresql://external_workforce_platform:password@localhost:5433/external_workforce_platform';

  it('allows test + external_workforce_platform_e2e', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(E2E_URL, 'test'),
    ).not.toThrow();
  });

  it('rejects test + external_workforce_platform (development database)', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(DEV_URL, 'test'),
    ).toThrow('E2E_DATABASE_SAFETY: refusing cleanup for database "external_workforce_platform"');
  });

  it('rejects development + external_workforce_platform_e2e', () => {
    expect(() =>
      assertSafeE2eDatabaseTarget(E2E_URL, 'development'),
    ).toThrow('E2E_DATABASE_SAFETY: refusing cleanup for database "external_workforce_platform_e2e"');
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
