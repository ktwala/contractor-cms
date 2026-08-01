import {
  applyResponsibleManagerContractorScope,
  applyResponsibleManagerEngagementScope,
  buildResponsibleManagerEngagementFilter,
} from './responsible-manager-scope.helper';
import { AccessContext } from '../interfaces/access-context.interface';

describe('responsible-manager-scope.helper', () => {
  const scoped: AccessContext = {
    effectivePermissions: new Set(['engagements:read']),
    actorUserId: 'u1',
    actorOrganizationId: 'org-1',
    targetOrganizationId: 'org-1',
    isGlobalAccess: false,
    supplierScopeId: null,
    responsibleManagerEmployeeId: 'cms:emp:sponsor-demo',
  };

  const unscoped: AccessContext = {
    ...scoped,
    responsibleManagerEmployeeId: null,
  };

  it('buildResponsibleManagerEngagementFilter returns OR on primary and delegate', () => {
    expect(buildResponsibleManagerEngagementFilter(scoped)).toEqual({
      OR: [
        { responsibleManagerEmployeeId: 'cms:emp:sponsor-demo' },
        { responsibleManagerDelegateEmployeeId: 'cms:emp:sponsor-demo' },
      ],
    });
    expect(buildResponsibleManagerEngagementFilter(unscoped)).toBeNull();
  });

  it('applyResponsibleManagerEngagementScope adds AND filter', () => {
    const where: Record<string, unknown> = { isActive: true };
    applyResponsibleManagerEngagementScope(where, scoped);
    expect(where.AND).toEqual([
      {
        OR: [
          { responsibleManagerEmployeeId: 'cms:emp:sponsor-demo' },
          { responsibleManagerDelegateEmployeeId: 'cms:emp:sponsor-demo' },
        ],
      },
    ]);
  });

  it('applyResponsibleManagerContractorScope requires sponsored engagement', () => {
    const where: Record<string, unknown> = {};
    applyResponsibleManagerContractorScope(where, scoped);
    expect(where.engagements).toEqual({
      some: {
        OR: [
          { responsibleManagerEmployeeId: 'cms:emp:sponsor-demo' },
          { responsibleManagerDelegateEmployeeId: 'cms:emp:sponsor-demo' },
        ],
      },
    });
  });
});
