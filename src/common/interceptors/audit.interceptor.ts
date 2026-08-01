import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, body, headers } = request;
    const userId = (request as any).user?.sub || 'anonymous';
    const reason = headers['x-reason'] as string;
    const startTime = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
            this.logger.log({
              action: `${method} ${url}`,
              userId,
              reason,
              duration: `${duration}ms`,
              success: true,
            });
          }
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.warn({
            action: `${method} ${url}`,
            userId,
            reason,
            duration: `${duration}ms`,
            success: false,
            error: error.message,
          });
        },
      }),
    );
  }
}
