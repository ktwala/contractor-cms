import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import {
  P as BackendP,
  RECRUITMENT_PERMISSIONS,
  RECRUITMENT_ALL,
} from '../../../common/constants/permissions';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { RecruitmentController } from '../recruitment.controller';

const CANONICAL_RECRUITMENT_PERMISSIONS = [
  'recruitment:requisitions:create',
  'recruitment:requisitions:view',
  'recruitment:requisitions:update',
  'recruitment:requisitions:approve',
  'recruitment:requisitions:post',
  'recruitment:requisitions:manage',
  'recruitment:candidates:create',
  'recruitment:candidates:view',
  'recruitment:applications:create',
  'recruitment:applications:view',
  'recruitment:applications:manage',
  'recruitment:applications:rate',
  'recruitment:interviews:schedule',
  'recruitment:interviews:view',
  'recruitment:interviews:feedback',
  'recruitment:interviews:manage',
  'recruitment:offers:create',
  'recruitment:offers:approve',
  'recruitment:offers:send',
  'recruitment:offers:view',
  'recruitment:onboarding:create',
  'recruitment:onboarding:view',
  'recruitment:onboarding:complete_tasks',
  'recruitment:onboarding:manage_documents',
  'recruitment:onboarding:upload_documents',
  'recruitment:onboarding:verify_documents',
  'recruitment:onboarding:manage_equipment',
  'recruitment:onboarding:assign_equipment',
  'recruitment:onboarding:manage_access',
  'recruitment:onboarding:provision_access',
];

describe('Recruitment Permission Registry Consistency', () => {
  describe('backend P.* constants match canonical set', () => {
    it('RECRUITMENT_ALL contains all canonical permissions', () => {
      expect(RECRUITMENT_ALL.sort()).toEqual(CANONICAL_RECRUITMENT_PERMISSIONS.sort());
    });

    it('every canonical permission has a corresponding P.RECRUITMENT_* constant', () => {
      const allPValues = Object.values(BackendP);
      for (const perm of CANONICAL_RECRUITMENT_PERMISSIONS) {
        expect(allPValues).toContain(perm);
      }
    });

    it('RECRUITMENT_PERMISSIONS group structure is correct', () => {
      expect(Object.keys(RECRUITMENT_PERMISSIONS).sort()).toEqual([
        'applications',
        'candidates',
        'interviews',
        'offers',
        'onboarding',
        'requisitions',
      ]);
    });
  });

  describe('controller decorators use P.* constants (not inline strings)', () => {
    const proto = RecruitmentController.prototype;

    const handlerChecks: { method: string; expected: string }[] = [
      { method: 'createRequisition', expected: BackendP.RECRUITMENT_REQUISITIONS_CREATE },
      { method: 'approveRequisition', expected: BackendP.RECRUITMENT_REQUISITIONS_APPROVE },
      { method: 'postRequisition', expected: BackendP.RECRUITMENT_REQUISITIONS_POST },
      { method: 'closeRequisition', expected: BackendP.RECRUITMENT_REQUISITIONS_MANAGE },
      { method: 'getOpenRequisitions', expected: BackendP.RECRUITMENT_REQUISITIONS_VIEW },
      { method: 'getRequisitionDetails', expected: BackendP.RECRUITMENT_REQUISITIONS_VIEW },
      { method: 'updateRequisition', expected: BackendP.RECRUITMENT_REQUISITIONS_UPDATE },
      { method: 'createCandidate', expected: BackendP.RECRUITMENT_CANDIDATES_CREATE },
      { method: 'submitApplication', expected: BackendP.RECRUITMENT_APPLICATIONS_CREATE },
      { method: 'moveApplicationStage', expected: BackendP.RECRUITMENT_APPLICATIONS_MANAGE },
      { method: 'rejectApplication', expected: BackendP.RECRUITMENT_APPLICATIONS_MANAGE },
      { method: 'getApplicationsForRequisition', expected: BackendP.RECRUITMENT_APPLICATIONS_VIEW },
      { method: 'getCandidateProfile', expected: BackendP.RECRUITMENT_CANDIDATES_VIEW },
      { method: 'rateApplication', expected: BackendP.RECRUITMENT_APPLICATIONS_RATE },
      { method: 'scheduleInterview', expected: BackendP.RECRUITMENT_INTERVIEWS_SCHEDULE },
      { method: 'submitFeedback', expected: BackendP.RECRUITMENT_INTERVIEWS_FEEDBACK },
      { method: 'completeInterview', expected: BackendP.RECRUITMENT_INTERVIEWS_MANAGE },
      { method: 'cancelInterview', expected: BackendP.RECRUITMENT_INTERVIEWS_MANAGE },
      { method: 'getInterviewsForApplication', expected: BackendP.RECRUITMENT_INTERVIEWS_VIEW },
      { method: 'getMyInterviews', expected: BackendP.RECRUITMENT_INTERVIEWS_VIEW },
      { method: 'createOffer', expected: BackendP.RECRUITMENT_OFFERS_CREATE },
      { method: 'approveOffer', expected: BackendP.RECRUITMENT_OFFERS_APPROVE },
      { method: 'sendOffer', expected: BackendP.RECRUITMENT_OFFERS_SEND },
      { method: 'getOfferDetails', expected: BackendP.RECRUITMENT_OFFERS_VIEW },
      { method: 'getOffersForApplication', expected: BackendP.RECRUITMENT_OFFERS_VIEW },
      { method: 'getPendingOffers', expected: BackendP.RECRUITMENT_OFFERS_VIEW },
      { method: 'createOnboardingWorkflow', expected: BackendP.RECRUITMENT_ONBOARDING_CREATE },
      { method: 'completeOnboardingTask', expected: BackendP.RECRUITMENT_ONBOARDING_COMPLETE_TASKS },
      { method: 'addRequiredDocument', expected: BackendP.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS },
      { method: 'uploadDocument', expected: BackendP.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS },
      { method: 'verifyDocument', expected: BackendP.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS },
      { method: 'addEquipment', expected: BackendP.RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT },
      { method: 'assignEquipment', expected: BackendP.RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT },
      { method: 'addSystemAccess', expected: BackendP.RECRUITMENT_ONBOARDING_MANAGE_ACCESS },
      { method: 'provisionAccess', expected: BackendP.RECRUITMENT_ONBOARDING_PROVISION_ACCESS },
      { method: 'getOnboardingWorkflow', expected: BackendP.RECRUITMENT_ONBOARDING_VIEW },
      { method: 'getMyOnboardingTasks', expected: BackendP.RECRUITMENT_ONBOARDING_VIEW },
    ];

    for (const { method, expected } of handlerChecks) {
      it(`${method} uses ${expected}`, () => {
        const perms = Reflect.getMetadata(PERMISSIONS_KEY, (proto as any)[method]);
        expect(perms).toContain(expected);
      });
    }

    it('acceptOffer and declineOffer have NO permission decorator (public endpoints)', () => {
      const acceptPerms = Reflect.getMetadata(PERMISSIONS_KEY, proto.acceptOffer);
      const declinePerms = Reflect.getMetadata(PERMISSIONS_KEY, proto.declineOffer);
      expect(acceptPerms).toBeUndefined();
      expect(declinePerms).toBeUndefined();
    });
  });

  describe('frontend permissions file is in sync', () => {
    const frontendPath = path.resolve(
      __dirname,
      '../../../../admin-portal/src/constants/permissions.ts',
    );

    it('frontend permissions.ts contains all canonical recruitment permission strings', () => {
      const content = fs.readFileSync(frontendPath, 'utf-8');
      for (const perm of CANONICAL_RECRUITMENT_PERMISSIONS) {
        expect(content).toContain(`'${perm}'`);
      }
    });
  });

  describe('surface registry covers all canonical permissions', () => {
    it('surface registry file references every P.RECRUITMENT_* constant', () => {
      const registryPath = path.resolve(
        __dirname,
        '../../../../admin-portal/src/lib/permissions/recruitmentSurfaceRegistry.ts',
      );
      const content = fs.readFileSync(registryPath, 'utf-8');

      const recruitmentPKeys = Object.keys(BackendP)
        .filter((k) => k.startsWith('RECRUITMENT_'));

      for (const key of recruitmentPKeys) {
        expect(content).toContain(`P.${key}`);
      }
    });
  });

  describe('seed file contains all canonical permissions', () => {
    it('prisma/seed.ts includes every canonical recruitment permission string', () => {
      const seedPath = path.resolve(__dirname, '../../../../prisma/seed.ts');
      const content = fs.readFileSync(seedPath, 'utf-8');

      for (const perm of CANONICAL_RECRUITMENT_PERMISSIONS) {
        expect(content).toContain(`'${perm}'`);
      }
    });
  });

  describe('sidebar uses recruitment-specific permission', () => {
    it('AdminLayout.tsx references recruitment:requisitions:view (not iam:users:manage) for Talent nav', () => {
      const layoutPath = path.resolve(
        __dirname,
        '../../../../admin-portal/src/components/AdminLayout.tsx',
      );
      const content = fs.readFileSync(layoutPath, 'utf-8');

      const talentSectionMatch = content.match(/title:\s*'Talent'[\s\S]*?requiredPermissions:\s*\[([^\]]*)\]/);
      expect(talentSectionMatch).not.toBeNull();
      expect(talentSectionMatch![1]).toContain("'recruitment:requisitions:view'");
      expect(talentSectionMatch![1]).not.toContain("'iam:users:manage'");
    });
  });
});
