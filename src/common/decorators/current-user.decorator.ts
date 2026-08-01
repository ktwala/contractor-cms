import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface CurrentUserData {
  sub: string;
  email: string;
  roles: string[];
  permissions: string[];
  legalEntityAccess: string[];
  hasGlobalScope?: boolean;
  organizationId?: string;
  employeeId?: string;
}

export const CurrentUser = createParamDecorator(
  (data: keyof CurrentUserData | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as CurrentUserData;

    return data ? user?.[data] : user;
  },
);
