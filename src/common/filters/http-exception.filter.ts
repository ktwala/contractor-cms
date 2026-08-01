import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

interface ErrorResponse {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let errorResponse: ErrorResponse = {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        errorResponse = {
          code: this.getErrorCode(status),
          message: exceptionResponse,
        };
      } else if (typeof exceptionResponse === 'object') {
        const resp = exceptionResponse as Record<string, unknown>;
        errorResponse = {
          code: (resp.code as string) || this.getErrorCode(status),
          message: (resp.message as string) || exception.message,
          details: resp.details as Record<string, unknown>,
        };

        // Handle validation errors
        if (Array.isArray(resp.message)) {
          errorResponse.message = 'Validation failed';
          errorResponse.details = { errors: resp.message };
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`Unhandled exception: ${exception.message}`, exception.stack);
      
      // Capture unhandled exceptions in Sentry
      try {
        Sentry.captureException(exception, {
          tags: {
            path: request.url,
            method: request.method,
          },
          extra: {
            body: request.body,
            query: request.query,
            params: request.params,
          },
        });
      } catch (sentryError) {
        // Sentry not initialized or error capturing - ignore
        this.logger.debug('Sentry error capture failed', sentryError);
      }
    }

    response.status(status).json({
      ...errorResponse,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }

  private getErrorCode(status: number): string {
    const codes: Record<number, string> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'TOO_MANY_REQUESTS',
      500: 'INTERNAL_ERROR',
    };
    return codes[status] || 'UNKNOWN_ERROR';
  }
}
