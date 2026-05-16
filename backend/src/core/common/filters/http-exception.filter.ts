import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

import { AuditService } from '../../audit/audit.service';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  constructor(private readonly auditService?: AuditService) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'Internal Server Error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || message;
        error = (exceptionResponse as any).error || error;
      } else {
        message = exceptionResponse as string;
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // Extended logging for 400 and 403 errors
    if (status === HttpStatus.BAD_REQUEST || status === HttpStatus.FORBIDDEN) {
      const reqUser = (request as any).user;
      const debugLog = {
        requestId: request.headers['x-request-id'] || Date.now().toString(),
        method: request.method,
        path: request.url,
        queryParams: request.query,
        bodyKeys: request.body ? Object.keys(request.body) : [],
        user: reqUser ? {
          id: reqUser.id,
          roles: reqUser.roles?.map((r: any) => r.name || r) || [],
          organizationId: reqUser.organizationId,
          permissionsCount: reqUser.permissions?.length || 0,
          permissions: reqUser.permissions || [],
        } : 'unauthenticated',
        validationDetails: exception instanceof HttpException ? exception.getResponse() : null,
      };

      this.logger.warn(`[API_REJECTED] ${status} ${request.method} ${request.url}\n${JSON.stringify(debugLog, null, 2)}`);

      // 400 Bad Request — check if it's a ValidationPipe error about organizationId
      if (status === HttpStatus.BAD_REQUEST && this.auditService) {
        const resObj: any = exception instanceof HttpException ? exception.getResponse() : {};
        if (resObj.message && Array.isArray(resObj.message)) {
          const isOrgSpoof = resObj.message.some((m: string) => m.includes('organizationId should not exist'));
          if (isOrgSpoof && reqUser) {
            this.auditService.logAction(
              reqUser.id,
              'VALIDATION_SPOOF_400',
              'Route',
              request.url,
              null,
              null,
              {
                organizationId: reqUser.organizationId || null,
                severity: 'CRITICAL',
                tags: ['SPOOF_ATTEMPT', 'MALICIOUS_PARAM'],
                ipAddress: request.ip,
                userAgent: request.headers['user-agent'],
                metadata: debugLog
              }
            ).catch(e => this.logger.error('Failed to audit spoof attempt', e));
          }
        }
      }
    } else {
      // Log standard errors
      this.logger.error(
        `${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : exception,
      );
    }

    // Send response
    response.status(status).json({
      statusCode: status,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
