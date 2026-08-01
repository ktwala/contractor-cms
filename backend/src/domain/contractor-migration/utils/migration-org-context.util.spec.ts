import { BadRequestException } from '@nestjs/common';
import { resolveMigrationOrganizationId } from './migration-org-context.util';

describe('resolveMigrationOrganizationId', () => {
  const base = {
    actorUserId: 'u1',
    actorOrganizationId: null,
    targetOrganizationId: null,
    isGlobalAccess: true,
    effectivePermissions: new Set(['*:*']),
    supplierScopeId: null,
    responsibleManagerEmployeeId: null,
  };

  it('uses targetOrganizationId for scoped users', () => {
    expect(
      resolveMigrationOrganizationId({
        ...base,
        targetOrganizationId: 'org-scoped',
        isGlobalAccess: false,
      }),
    ).toBe('org-scoped');
  });

  it('requires explicit org for global admin without tenant', () => {
    expect(() => resolveMigrationOrganizationId(base)).toThrow(BadRequestException);
    expect(
      resolveMigrationOrganizationId(base, 'org-explicit'),
    ).toBe('org-explicit');
  });

  it('rejects explicit org that conflicts with scoped context', () => {
    expect(() =>
      resolveMigrationOrganizationId(
        { ...base, targetOrganizationId: 'org-a', isGlobalAccess: false },
        'org-b',
      ),
    ).toThrow(BadRequestException);
  });
});
