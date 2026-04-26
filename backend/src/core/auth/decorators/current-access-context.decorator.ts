import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AccessContext } from '../interfaces/access-context.interface';

export const CurrentAccessContext = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): AccessContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.accessContext;
  },
);
