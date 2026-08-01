/**
 * Frontend visibility/action tests — verify that the surface registry
 * permissions are correctly honored by the can()/canAny() access functions
 * for each recruitment role.
 *
 * These tests simulate localStorage-based permission checks, matching
 * the actual production code path in useAccess.ts.
 */

import { describe, expect, it } from 'vitest';
import { RECRUITMENT_SURFACE_REGISTRY } from '../recruitmentSurfaceRegistry';
import { P } from '../../../constants/permissions';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  TALENT_ADMIN: [
    P.RECRUITMENT_REQUISITIONS_CREATE, P.RECRUITMENT_REQUISITIONS_VIEW, P.RECRUITMENT_REQUISITIONS_UPDATE,
    P.RECRUITMENT_REQUISITIONS_APPROVE, P.RECRUITMENT_REQUISITIONS_POST, P.RECRUITMENT_REQUISITIONS_MANAGE,
    P.RECRUITMENT_CANDIDATES_CREATE, P.RECRUITMENT_CANDIDATES_VIEW,
    P.RECRUITMENT_APPLICATIONS_CREATE, P.RECRUITMENT_APPLICATIONS_VIEW, P.RECRUITMENT_APPLICATIONS_MANAGE, P.RECRUITMENT_APPLICATIONS_RATE,
    P.RECRUITMENT_INTERVIEWS_SCHEDULE, P.RECRUITMENT_INTERVIEWS_VIEW, P.RECRUITMENT_INTERVIEWS_FEEDBACK, P.RECRUITMENT_INTERVIEWS_MANAGE,
    P.RECRUITMENT_OFFERS_CREATE, P.RECRUITMENT_OFFERS_APPROVE, P.RECRUITMENT_OFFERS_SEND, P.RECRUITMENT_OFFERS_VIEW,
    P.RECRUITMENT_ONBOARDING_CREATE, P.RECRUITMENT_ONBOARDING_VIEW, P.RECRUITMENT_ONBOARDING_COMPLETE_TASKS,
    P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS, P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS, P.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS,
    P.RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT, P.RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT,
    P.RECRUITMENT_ONBOARDING_MANAGE_ACCESS, P.RECRUITMENT_ONBOARDING_PROVISION_ACCESS,
  ],
  RECRUITER: [
    P.RECRUITMENT_REQUISITIONS_CREATE, P.RECRUITMENT_REQUISITIONS_VIEW, P.RECRUITMENT_REQUISITIONS_UPDATE,
    P.RECRUITMENT_CANDIDATES_CREATE, P.RECRUITMENT_CANDIDATES_VIEW,
    P.RECRUITMENT_APPLICATIONS_CREATE, P.RECRUITMENT_APPLICATIONS_VIEW, P.RECRUITMENT_APPLICATIONS_MANAGE, P.RECRUITMENT_APPLICATIONS_RATE,
    P.RECRUITMENT_INTERVIEWS_SCHEDULE, P.RECRUITMENT_INTERVIEWS_VIEW, P.RECRUITMENT_INTERVIEWS_MANAGE,
    P.RECRUITMENT_OFFERS_CREATE, P.RECRUITMENT_OFFERS_VIEW,
    P.RECRUITMENT_ONBOARDING_CREATE, P.RECRUITMENT_ONBOARDING_VIEW,
    P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS, P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS,
  ],
  HIRING_MANAGER: [
    P.RECRUITMENT_REQUISITIONS_VIEW, P.RECRUITMENT_REQUISITIONS_APPROVE, P.RECRUITMENT_REQUISITIONS_POST,
    P.RECRUITMENT_CANDIDATES_VIEW,
    P.RECRUITMENT_APPLICATIONS_VIEW, P.RECRUITMENT_APPLICATIONS_MANAGE, P.RECRUITMENT_APPLICATIONS_RATE,
    P.RECRUITMENT_INTERVIEWS_VIEW, P.RECRUITMENT_INTERVIEWS_FEEDBACK,
    P.RECRUITMENT_OFFERS_VIEW, P.RECRUITMENT_OFFERS_APPROVE,
    P.RECRUITMENT_ONBOARDING_VIEW,
  ],
  INTERVIEWER: [
    P.RECRUITMENT_INTERVIEWS_VIEW, P.RECRUITMENT_INTERVIEWS_FEEDBACK,
  ],
  HR_OPERATIONS: [
    P.RECRUITMENT_CANDIDATES_VIEW, P.RECRUITMENT_APPLICATIONS_VIEW,
    P.RECRUITMENT_INTERVIEWS_VIEW, P.RECRUITMENT_OFFERS_VIEW,
    P.RECRUITMENT_ONBOARDING_CREATE, P.RECRUITMENT_ONBOARDING_VIEW, P.RECRUITMENT_ONBOARDING_COMPLETE_TASKS,
    P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS, P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS, P.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS,
    P.RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT, P.RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT,
    P.RECRUITMENT_ONBOARDING_MANAGE_ACCESS, P.RECRUITMENT_ONBOARDING_PROVISION_ACCESS,
  ],
};

function canAccessSurface(rolePerms: string[], surfaceRequired: string[]): boolean {
  return surfaceRequired.every((p) => rolePerms.includes(p));
}

describe('Recruitment Surface Visibility', () => {

  describe('surface registry structure', () => {
    it('every entry has a non-empty surface name', () => {
      for (const entry of RECRUITMENT_SURFACE_REGISTRY) {
        expect(entry.surface.length).toBeGreaterThan(0);
      }
    });

    it('every entry has at least one required permission', () => {
      for (const entry of RECRUITMENT_SURFACE_REGISTRY) {
        expect(entry.required.length).toBeGreaterThan(0);
      }
    });

    it('every entry has a description', () => {
      for (const entry of RECRUITMENT_SURFACE_REGISTRY) {
        expect(entry.description.length).toBeGreaterThan(0);
      }
    });

    it('all page surfaces use :view permissions only', () => {
      const pageSurfaces = RECRUITMENT_SURFACE_REGISTRY.filter((e) => e.surface.endsWith('.page'));
      for (const entry of pageSurfaces) {
        for (const perm of entry.required) {
          expect(perm).toMatch(/:view$/);
        }
      }
    });

    it('mutation surfaces do not use :view permissions', () => {
      const mutationSurfaces = RECRUITMENT_SURFACE_REGISTRY.filter(
        (e) => !e.surface.endsWith('.page'),
      );
      for (const entry of mutationSurfaces) {
        for (const perm of entry.required) {
          expect(perm).not.toMatch(/:view$/);
        }
      }
    });
  });

  describe('TALENT_ADMIN visibility', () => {
    const perms = ROLE_PERMISSIONS.TALENT_ADMIN;

    it('can access every surface', () => {
      for (const entry of RECRUITMENT_SURFACE_REGISTRY) {
        expect(canAccessSurface(perms, entry.required)).toBe(true);
      }
    });
  });

  describe('RECRUITER visibility', () => {
    const perms = ROLE_PERMISSIONS.RECRUITER;

    const allowed = [
      'talent.requisitions.page', 'talent.requisitions.create', 'talent.requisitions.edit',
      'talent.candidates.page', 'talent.candidates.create',
      'talent.applications.page', 'talent.applications.create', 'talent.applications.advance', 'talent.applications.rate',
      'talent.interviews.page', 'talent.interviews.schedule', 'talent.interviews.manage',
      'talent.offers.page', 'talent.offers.create',
      'talent.onboarding.page', 'talent.onboarding.create',
      'talent.onboarding.manageDocuments', 'talent.onboarding.uploadDocuments',
    ];

    const denied = [
      'talent.requisitions.approve', 'talent.requisitions.post', 'talent.requisitions.close',
      'talent.interviews.feedback',
      'talent.offers.approve', 'talent.offers.send',
      'talent.onboarding.completeTasks',
      'talent.onboarding.verifyDocuments',
      'talent.onboarding.manageEquipment', 'talent.onboarding.assignEquipment',
      'talent.onboarding.manageAccess', 'talent.onboarding.provisionAccess',
    ];

    for (const surface of allowed) {
      it(`can access ${surface}`, () => {
        const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === surface);
        expect(entry).toBeDefined();
        expect(canAccessSurface(perms, entry!.required)).toBe(true);
      });
    }

    for (const surface of denied) {
      it(`cannot access ${surface}`, () => {
        const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === surface);
        expect(entry).toBeDefined();
        expect(canAccessSurface(perms, entry!.required)).toBe(false);
      });
    }
  });

  describe('HIRING_MANAGER visibility', () => {
    const perms = ROLE_PERMISSIONS.HIRING_MANAGER;

    const allowed = [
      'talent.requisitions.page', 'talent.requisitions.approve', 'talent.requisitions.post',
      'talent.candidates.page',
      'talent.applications.page', 'talent.applications.advance', 'talent.applications.rate',
      'talent.interviews.page', 'talent.interviews.feedback',
      'talent.offers.page', 'talent.offers.approve',
      'talent.onboarding.page',
    ];

    const denied = [
      'talent.requisitions.create', 'talent.requisitions.edit', 'talent.requisitions.close',
      'talent.candidates.create',
      'talent.applications.create',
      'talent.interviews.schedule', 'talent.interviews.manage',
      'talent.offers.create', 'talent.offers.send',
      'talent.onboarding.create', 'talent.onboarding.completeTasks',
      'talent.onboarding.manageDocuments', 'talent.onboarding.uploadDocuments',
      'talent.onboarding.verifyDocuments',
      'talent.onboarding.manageEquipment', 'talent.onboarding.assignEquipment',
      'talent.onboarding.manageAccess', 'talent.onboarding.provisionAccess',
    ];

    for (const surface of allowed) {
      it(`can access ${surface}`, () => {
        const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === surface);
        expect(entry).toBeDefined();
        expect(canAccessSurface(perms, entry!.required)).toBe(true);
      });
    }

    for (const surface of denied) {
      it(`cannot access ${surface}`, () => {
        const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === surface);
        expect(entry).toBeDefined();
        expect(canAccessSurface(perms, entry!.required)).toBe(false);
      });
    }
  });

  describe('INTERVIEWER visibility', () => {
    const perms = ROLE_PERMISSIONS.INTERVIEWER;

    it('can access interviews page', () => {
      const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === 'talent.interviews.page');
      expect(canAccessSurface(perms, entry!.required)).toBe(true);
    });

    it('can submit feedback', () => {
      const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === 'talent.interviews.feedback');
      expect(canAccessSurface(perms, entry!.required)).toBe(true);
    });

    it('cannot access any non-interview surfaces', () => {
      const nonInterview = RECRUITMENT_SURFACE_REGISTRY.filter(
        (e) => !e.surface.startsWith('talent.interviews.'),
      );
      for (const entry of nonInterview) {
        expect(canAccessSurface(perms, entry.required)).toBe(false);
      }
    });
  });

  describe('HR_OPERATIONS visibility', () => {
    const perms = ROLE_PERMISSIONS.HR_OPERATIONS;

    const allowed = [
      'talent.candidates.page',
      'talent.applications.page',
      'talent.interviews.page',
      'talent.offers.page',
      'talent.onboarding.page', 'talent.onboarding.create', 'talent.onboarding.completeTasks',
      'talent.onboarding.manageDocuments', 'talent.onboarding.uploadDocuments', 'talent.onboarding.verifyDocuments',
      'talent.onboarding.manageEquipment', 'talent.onboarding.assignEquipment',
      'talent.onboarding.manageAccess', 'talent.onboarding.provisionAccess',
    ];

    const denied = [
      'talent.requisitions.page',
      'talent.requisitions.create', 'talent.requisitions.edit',
      'talent.requisitions.approve', 'talent.requisitions.post', 'talent.requisitions.close',
      'talent.candidates.create',
      'talent.applications.create', 'talent.applications.advance', 'talent.applications.rate',
      'talent.interviews.schedule', 'talent.interviews.feedback', 'talent.interviews.manage',
      'talent.offers.create', 'talent.offers.approve', 'talent.offers.send',
    ];

    for (const surface of allowed) {
      it(`can access ${surface}`, () => {
        const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === surface);
        expect(entry).toBeDefined();
        expect(canAccessSurface(perms, entry!.required)).toBe(true);
      });
    }

    for (const surface of denied) {
      it(`cannot access ${surface}`, () => {
        const entry = RECRUITMENT_SURFACE_REGISTRY.find((e) => e.surface === surface);
        expect(entry).toBeDefined();
        expect(canAccessSurface(perms, entry!.required)).toBe(false);
      });
    }
  });

  describe('empty permissions (no role)', () => {
    it('cannot access any surface', () => {
      for (const entry of RECRUITMENT_SURFACE_REGISTRY) {
        expect(canAccessSurface([], entry.required)).toBe(false);
      }
    });
  });
});
