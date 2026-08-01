import { BadRequestException } from '@nestjs/common';
import { EvidenceChecklistResult } from './supplier-evidence.types';

export const SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE =
  'SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE';

export class SupplierOnboardingEvidenceIncompleteException extends BadRequestException {
  constructor(checklist: EvidenceChecklistResult) {
    super({
      statusCode: 400,
      message:
        'Required onboarding evidence is incomplete or expired. Upload all required documents before approval.',
      error: 'Bad Request',
      code: SUPPLIER_ONBOARDING_EVIDENCE_INCOMPLETE,
      checklist,
    });
  }
}
