import {
  hasResponsibleManagerScopePermissions,
  resolveSponsorEmployeeId,
} from './responsible-manager-identity.helper';

describe('responsible-manager-identity.helper (PR-HCM-SPONSOR-USERS-1)', () => {
  const sponsorReads = new Set([
    'contractors:read',
    'engagements:read',
    'engagements:update',
  ]);

  it('User.externalId + sponsor reads grants sponsor scope', () => {
    expect(
      resolveSponsorEmployeeId({
        externalId: 'ewp:emp:abc',
        userType: 'INTERNAL',
        isGlobalAccess: false,
        userPermissions: sponsorReads,
      }),
    ).toBe('ewp:emp:abc');
  });

  it('SPONSOR-capable permissions alone without externalId does not grant scope', () => {
    expect(
      resolveSponsorEmployeeId({
        externalId: null,
        userType: 'INTERNAL',
        isGlobalAccess: false,
        userPermissions: sponsorReads,
      }),
    ).toBeNull();
  });

  it('externalId without sponsor read permissions does not over-broaden', () => {
    expect(
      resolveSponsorEmployeeId({
        externalId: 'ewp:emp:abc',
        userType: 'INTERNAL',
        isGlobalAccess: false,
        userPermissions: new Set(['profile:read', 'profile:update']),
      }),
    ).toBeNull();
  });

  it('global access suppresses sponsor row scope even with externalId', () => {
    expect(
      resolveSponsorEmployeeId({
        externalId: 'ewp:emp:abc',
        userType: 'INTERNAL',
        isGlobalAccess: true,
        userPermissions: sponsorReads,
      }),
    ).toBeNull();
  });

  it('non-internal users never receive sponsor scope', () => {
    expect(
      resolveSponsorEmployeeId({
        externalId: 'ewp:emp:abc',
        userType: 'EXTERNAL',
        isGlobalAccess: false,
        userPermissions: sponsorReads,
      }),
    ).toBeNull();
  });

  it('hasResponsibleManagerScopePermissions accepts resource wildcards', () => {
    expect(
      hasResponsibleManagerScopePermissions(
        new Set(['contractors:*', 'engagements:read']),
      ),
    ).toBe(true);
  });
});
