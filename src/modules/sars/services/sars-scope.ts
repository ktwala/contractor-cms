import { ForbiddenException } from '@nestjs/common';

export type RequestUser = {
  sub: string;
  roles?: string[];
  permissions?: string[];
  legalEntityAccess?: string[];
};

export function assertHasLegalEntities(user: RequestUser): string[] {
  const allowed = user.legalEntityAccess || [];
  if (allowed.length === 0) {
    throw new ForbiddenException({
      code: 'PAYROLL_LEGAL_ENTITY_REQUIRED',
      message: 'No legal entity access assigned to this user. Create a legal entity and assign it first.',
    });
  }
  return allowed;
}

export function assertLegalEntityAllowed(user: RequestUser, legalEntityId: string) {
  const allowed = assertHasLegalEntities(user);
  if (!allowed.includes(legalEntityId)) {
    throw new ForbiddenException({
      code: 'PAYROLL_LEGAL_ENTITY_DENIED',
      message: 'No access to this legal entity',
    });
  }
}
