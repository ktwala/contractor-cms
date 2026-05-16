import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { IntegrationActorContext } from '../extid-events.types';

export const IntegrationActor = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): IntegrationActorContext => {
    const request = ctx.switchToHttp().getRequest();
    return request.integrationActor;
  },
);
