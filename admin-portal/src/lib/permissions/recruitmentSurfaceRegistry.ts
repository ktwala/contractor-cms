import { P } from '../../constants/permissions';

export interface RecruitmentSurfaceEntry {
  surface: string;
  required: string[];
  description: string;
}

export const RECRUITMENT_SURFACE_REGISTRY: RecruitmentSurfaceEntry[] = [
  // ── Requisitions ────────────────────────────────────────────────
  {
    surface: 'talent.requisitions.page',
    required: [P.RECRUITMENT_REQUISITIONS_VIEW],
    description: 'Access requisitions page and list requisitions',
  },
  {
    surface: 'talent.requisitions.create',
    required: [P.RECRUITMENT_REQUISITIONS_CREATE],
    description: 'Create requisitions',
  },
  {
    surface: 'talent.requisitions.edit',
    required: [P.RECRUITMENT_REQUISITIONS_UPDATE],
    description: 'Edit draft/open requisitions',
  },
  {
    surface: 'talent.requisitions.approve',
    required: [P.RECRUITMENT_REQUISITIONS_APPROVE],
    description: 'Approve requisitions',
  },
  {
    surface: 'talent.requisitions.post',
    required: [P.RECRUITMENT_REQUISITIONS_POST],
    description: 'Post approved requisitions',
  },
  {
    surface: 'talent.requisitions.close',
    required: [P.RECRUITMENT_REQUISITIONS_MANAGE],
    description: 'Close/manage requisitions',
  },

  // ── Candidates ──────────────────────────────────────────────────
  {
    surface: 'talent.candidates.page',
    required: [P.RECRUITMENT_CANDIDATES_VIEW],
    description: 'Access candidates page and view candidates',
  },
  {
    surface: 'talent.candidates.create',
    required: [P.RECRUITMENT_CANDIDATES_CREATE],
    description: 'Create candidates',
  },

  // ── Applications ────────────────────────────────────────────────
  {
    surface: 'talent.applications.page',
    required: [P.RECRUITMENT_APPLICATIONS_VIEW],
    description: 'View applications',
  },
  {
    surface: 'talent.applications.create',
    required: [P.RECRUITMENT_APPLICATIONS_CREATE],
    description: 'Apply candidate to requisition',
  },
  {
    surface: 'talent.applications.advance',
    required: [P.RECRUITMENT_APPLICATIONS_MANAGE],
    description: 'Advance/reject/manage application stage',
  },
  {
    surface: 'talent.applications.rate',
    required: [P.RECRUITMENT_APPLICATIONS_RATE],
    description: 'Rate application',
  },

  // ── Interviews ──────────────────────────────────────────────────
  {
    surface: 'talent.interviews.page',
    required: [P.RECRUITMENT_INTERVIEWS_VIEW],
    description: 'Access interviews page and list interviews',
  },
  {
    surface: 'talent.interviews.schedule',
    required: [P.RECRUITMENT_INTERVIEWS_SCHEDULE],
    description: 'Schedule interviews',
  },
  {
    surface: 'talent.interviews.feedback',
    required: [P.RECRUITMENT_INTERVIEWS_FEEDBACK],
    description: 'Submit interview feedback',
  },
  {
    surface: 'talent.interviews.manage',
    required: [P.RECRUITMENT_INTERVIEWS_MANAGE],
    description: 'Cancel/complete/manage interviews',
  },

  // ── Offers ──────────────────────────────────────────────────────
  {
    surface: 'talent.offers.page',
    required: [P.RECRUITMENT_OFFERS_VIEW],
    description: 'Access offers list and detail views',
  },
  {
    surface: 'talent.offers.create',
    required: [P.RECRUITMENT_OFFERS_CREATE],
    description: 'Create offers',
  },
  {
    surface: 'talent.offers.approve',
    required: [P.RECRUITMENT_OFFERS_APPROVE],
    description: 'Approve offers',
  },
  {
    surface: 'talent.offers.send',
    required: [P.RECRUITMENT_OFFERS_SEND],
    description: 'Send offers',
  },

  // ── Onboarding ──────────────────────────────────────────────────
  {
    surface: 'talent.onboarding.page',
    required: [P.RECRUITMENT_ONBOARDING_VIEW],
    description:
      'Access new-hire onboarding and view workflows (lineage from offers; payroll Employment created when pay-group defaults exist, else setup task)',
  },
  {
    surface: 'talent.onboarding.create',
    required: [P.RECRUITMENT_ONBOARDING_CREATE],
    description:
      'Start onboarding from an accepted offer or application with an accepted offer (creates employee and workflow); HR may use employee_id via API',
  },
  {
    surface: 'talent.onboarding.completeTasks',
    required: [P.RECRUITMENT_ONBOARDING_COMPLETE_TASKS],
    description: 'Complete onboarding tasks',
  },
  {
    surface: 'talent.onboarding.manageDocuments',
    required: [P.RECRUITMENT_ONBOARDING_MANAGE_DOCUMENTS],
    description: 'Manage onboarding documents',
  },
  {
    surface: 'talent.onboarding.uploadDocuments',
    required: [P.RECRUITMENT_ONBOARDING_UPLOAD_DOCUMENTS],
    description: 'Upload onboarding documents',
  },
  {
    surface: 'talent.onboarding.verifyDocuments',
    required: [P.RECRUITMENT_ONBOARDING_VERIFY_DOCUMENTS],
    description: 'Verify onboarding documents',
  },
  {
    surface: 'talent.onboarding.manageEquipment',
    required: [P.RECRUITMENT_ONBOARDING_MANAGE_EQUIPMENT],
    description: 'Manage equipment tracking',
  },
  {
    surface: 'talent.onboarding.assignEquipment',
    required: [P.RECRUITMENT_ONBOARDING_ASSIGN_EQUIPMENT],
    description: 'Assign onboarding equipment',
  },
  {
    surface: 'talent.onboarding.manageAccess',
    required: [P.RECRUITMENT_ONBOARDING_MANAGE_ACCESS],
    description: 'Manage access provisioning workflow',
  },
  {
    surface: 'talent.onboarding.provisionAccess',
    required: [P.RECRUITMENT_ONBOARDING_PROVISION_ACCESS],
    description: 'Provision onboarding access',
  },
];
