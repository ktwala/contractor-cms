import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  INVALID_SUPPLIER_STATUS_TRANSITION,
  SUPPLIER_SELF_APPROVAL_FORBIDDEN,
  SUPPLIER_TRANSITION_REASON_REQUIRED,
} from './supplier-lifecycle.constants';

export class InvalidSupplierStatusTransitionException extends BadRequestException {
  constructor(fromStatus: string, toStatus: string, detail?: string) {
    super({
      statusCode: 400,
      message:
        detail ??
        `Invalid supplier status transition from ${fromStatus} to ${toStatus}`,
      error: 'Bad Request',
      code: INVALID_SUPPLIER_STATUS_TRANSITION,
      fromStatus,
      toStatus,
    });
  }
}

export class SupplierSelfApprovalForbiddenException extends ForbiddenException {
  constructor() {
    super({
      statusCode: 403,
      message:
        'Supplier membership users cannot approve or activate their own supplier record',
      error: 'Forbidden',
      code: SUPPLIER_SELF_APPROVAL_FORBIDDEN,
    });
  }
}

export class SupplierTransitionReasonRequiredException extends BadRequestException {
  constructor(transitionLabel = 'reject or suspend') {
    super({
      statusCode: 400,
      message: `A reviewer note is required to ${transitionLabel} a supplier pending approval`,
      error: 'Bad Request',
      code: SUPPLIER_TRANSITION_REASON_REQUIRED,
    });
  }
}
