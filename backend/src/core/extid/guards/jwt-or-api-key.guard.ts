import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ApiKeyAuthGuard } from '../../auth/guards/api-key-auth.guard';

/**
 * Accepts either JWT (Bearer) or integration API key (X-API-Key).
 * Use with @Public() so the global JWT guard does not block API-key-only callers.
 */
@Injectable()
export class JwtOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader) {
      return this.apiKeyGuard.canActivate(context);
    }
    return this.jwtGuard.canActivate(context);
  }
}
