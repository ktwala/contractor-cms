import { BadRequestException } from '@nestjs/common';
import { INVALID_CONTRACTOR_WORKFORCE_TRANSITION } from './contractor-workforce-state.constants';

export class InvalidContractorWorkforceTransitionException extends BadRequestException {
  constructor(fromState: string, toState: string, detail?: string) {
    super({
      statusCode: 400,
      message:
        detail ??
        `Invalid contractor workforce transition from ${fromState} to ${toState}`,
      error: 'Bad Request',
      code: INVALID_CONTRACTOR_WORKFORCE_TRANSITION,
      fromState,
      toState,
    });
  }
}
