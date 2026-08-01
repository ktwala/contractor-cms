import 'reflect-metadata';
import { P, RECRUITMENT_ALL } from '../../../common/constants/permissions';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { RecruitmentController } from '../recruitment.controller';

/**
 * Endpoint authorization behavior tests — prove actual allow/deny decisions
 * for each recruitment role. These simulate the PermissionsGuard logic:
 * a user with a given set of permissions can or cannot access a handler.
 *
 * This catches guard misapplication even when constants are correct.
 */

const ROLE_PERMISSIONS: Record<string, string[]> = {
  TALENT_ADMIN: [...RECRUITMENT_ALL],
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

function getRequiredPermissions(handler: Function): string[] {
  return Reflect.getMetadata(PERMISSIONS_KEY, handler) ?? [];
}

function canAccess(rolePerms: string[], requiredPerms: string[]): boolean {
  if (requiredPerms.length === 0) return true;
  return requiredPerms.every((p) => rolePerms.includes(p));
}

const proto = RecruitmentController.prototype;

describe('Recruitment Authorization Behavior', () => {

  describe('RECRUITER role', () => {
    const perms = ROLE_PERMISSIONS.RECRUITER;

    it('can create requisition', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createRequisition))).toBe(true);
    });

    it('can view requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getOpenRequisitions))).toBe(true);
    });

    it('can update requisition', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.updateRequisition))).toBe(true);
    });

    it('cannot approve requisition', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveRequisition))).toBe(false);
    });

    it('cannot post requisition', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.postRequisition))).toBe(false);
    });

    it('can create candidate', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createCandidate))).toBe(true);
    });

    it('can manage applications', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.moveApplicationStage))).toBe(true);
    });

    it('can schedule interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.scheduleInterview))).toBe(true);
    });

    it('cannot submit interview feedback', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.submitFeedback))).toBe(false);
    });

    it('can create offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createOffer))).toBe(true);
    });

    it('cannot approve offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveOffer))).toBe(false);
    });

    it('cannot send offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.sendOffer))).toBe(false);
    });

    it('cannot provision onboarding access', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.provisionAccess))).toBe(false);
    });

    it('cannot verify onboarding documents', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.verifyDocument))).toBe(false);
    });

    it('cannot assign onboarding equipment', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.assignEquipment))).toBe(false);
    });
  });

  describe('HIRING_MANAGER role', () => {
    const perms = ROLE_PERMISSIONS.HIRING_MANAGER;

    it('can view requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getOpenRequisitions))).toBe(true);
    });

    it('can approve requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveRequisition))).toBe(true);
    });

    it('can post requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.postRequisition))).toBe(true);
    });

    it('cannot create requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createRequisition))).toBe(false);
    });

    it('cannot update requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.updateRequisition))).toBe(false);
    });

    it('can manage applications', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.moveApplicationStage))).toBe(true);
    });

    it('can rate applications', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.rateApplication))).toBe(true);
    });

    it('can submit interview feedback', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.submitFeedback))).toBe(true);
    });

    it('cannot schedule interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.scheduleInterview))).toBe(false);
    });

    it('cannot manage interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.completeInterview))).toBe(false);
    });

    it('can approve offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveOffer))).toBe(true);
    });

    it('cannot create offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createOffer))).toBe(false);
    });

    it('cannot send offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.sendOffer))).toBe(false);
    });

    it('cannot provision onboarding access', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.provisionAccess))).toBe(false);
    });

    it('cannot assign onboarding equipment', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.assignEquipment))).toBe(false);
    });

    it('cannot complete onboarding tasks', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.completeOnboardingTask))).toBe(false);
    });
  });

  describe('INTERVIEWER role', () => {
    const perms = ROLE_PERMISSIONS.INTERVIEWER;

    it('can view interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getInterviewsForApplication))).toBe(true);
    });

    it('can submit interview feedback', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.submitFeedback))).toBe(true);
    });

    it('cannot schedule interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.scheduleInterview))).toBe(false);
    });

    it('cannot manage interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.completeInterview))).toBe(false);
    });

    it('cannot view requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getOpenRequisitions))).toBe(false);
    });

    it('cannot create requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createRequisition))).toBe(false);
    });

    it('cannot view candidates', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getCandidateProfile))).toBe(false);
    });

    it('cannot manage applications', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.moveApplicationStage))).toBe(false);
    });

    it('cannot view offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getOfferDetails))).toBe(false);
    });

    it('cannot approve offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveOffer))).toBe(false);
    });

    it('cannot access any onboarding', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getOnboardingWorkflow))).toBe(false);
    });
  });

  describe('HR_OPERATIONS role', () => {
    const perms = ROLE_PERMISSIONS.HR_OPERATIONS;

    it('can view candidates', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getCandidateProfile))).toBe(true);
    });

    it('can view applications', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getApplicationsForRequisition))).toBe(true);
    });

    it('can view offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.getOfferDetails))).toBe(true);
    });

    it('can create onboarding workflows', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createOnboardingWorkflow))).toBe(true);
    });

    it('can complete onboarding tasks', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.completeOnboardingTask))).toBe(true);
    });

    it('can upload documents', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.uploadDocument))).toBe(true);
    });

    it('can verify documents', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.verifyDocument))).toBe(true);
    });

    it('can assign equipment', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.assignEquipment))).toBe(true);
    });

    it('can provision access', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.provisionAccess))).toBe(true);
    });

    it('cannot create requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createRequisition))).toBe(false);
    });

    it('cannot approve requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveRequisition))).toBe(false);
    });

    it('cannot post requisitions', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.postRequisition))).toBe(false);
    });

    it('cannot create candidates', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createCandidate))).toBe(false);
    });

    it('cannot manage applications', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.moveApplicationStage))).toBe(false);
    });

    it('cannot schedule interviews', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.scheduleInterview))).toBe(false);
    });

    it('cannot create offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.createOffer))).toBe(false);
    });

    it('cannot approve offers', () => {
      expect(canAccess(perms, getRequiredPermissions(proto.approveOffer))).toBe(false);
    });
  });

  describe('TALENT_ADMIN role', () => {
    const perms = ROLE_PERMISSIONS.TALENT_ADMIN;

    it('can access every guarded recruitment endpoint', () => {
      const allHandlers = [
        proto.createRequisition, proto.approveRequisition, proto.postRequisition,
        proto.closeRequisition, proto.getOpenRequisitions, proto.getRequisitionDetails,
        proto.updateRequisition, proto.createCandidate, proto.submitApplication,
        proto.moveApplicationStage, proto.rejectApplication,
        proto.getApplicationsForRequisition, proto.getCandidateProfile, proto.rateApplication,
        proto.scheduleInterview, proto.submitFeedback, proto.completeInterview,
        proto.cancelInterview, proto.getInterviewsForApplication, proto.getMyInterviews,
        proto.createOffer, proto.approveOffer, proto.sendOffer,
        proto.getOfferDetails, proto.getOffersForApplication, proto.getPendingOffers,
        proto.createOnboardingWorkflow, proto.completeOnboardingTask,
        proto.addRequiredDocument, proto.uploadDocument, proto.verifyDocument,
        proto.addEquipment, proto.assignEquipment, proto.addSystemAccess,
        proto.provisionAccess, proto.getOnboardingWorkflow, proto.getMyOnboardingTasks,
      ];

      for (const handler of allHandlers) {
        const required = getRequiredPermissions(handler);
        expect(canAccess(perms, required)).toBe(true);
      }
    });
  });

  describe('separation of duties', () => {
    it('RECRUITER cannot do what only HIRING_MANAGER can', () => {
      const recruiterPerms = ROLE_PERMISSIONS.RECRUITER;
      expect(canAccess(recruiterPerms, getRequiredPermissions(proto.approveRequisition))).toBe(false);
      expect(canAccess(recruiterPerms, getRequiredPermissions(proto.postRequisition))).toBe(false);
      expect(canAccess(recruiterPerms, getRequiredPermissions(proto.approveOffer))).toBe(false);
    });

    it('HIRING_MANAGER cannot do what only RECRUITER can', () => {
      const hmPerms = ROLE_PERMISSIONS.HIRING_MANAGER;
      expect(canAccess(hmPerms, getRequiredPermissions(proto.createRequisition))).toBe(false);
      expect(canAccess(hmPerms, getRequiredPermissions(proto.scheduleInterview))).toBe(false);
      expect(canAccess(hmPerms, getRequiredPermissions(proto.createOffer))).toBe(false);
    });

    it('INTERVIEWER cannot perform any pipeline mutations', () => {
      const intPerms = ROLE_PERMISSIONS.INTERVIEWER;
      const mutations = [
        proto.createRequisition, proto.approveRequisition, proto.postRequisition,
        proto.createCandidate, proto.submitApplication, proto.moveApplicationStage,
        proto.scheduleInterview, proto.createOffer, proto.approveOffer, proto.sendOffer,
        proto.createOnboardingWorkflow, proto.provisionAccess,
      ];
      for (const handler of mutations) {
        expect(canAccess(intPerms, getRequiredPermissions(handler))).toBe(false);
      }
    });

    it('HR_OPERATIONS cannot approve requisitions or offers', () => {
      const hrPerms = ROLE_PERMISSIONS.HR_OPERATIONS;
      expect(canAccess(hrPerms, getRequiredPermissions(proto.approveRequisition))).toBe(false);
      expect(canAccess(hrPerms, getRequiredPermissions(proto.approveOffer))).toBe(false);
      expect(canAccess(hrPerms, getRequiredPermissions(proto.sendOffer))).toBe(false);
    });
  });
});
