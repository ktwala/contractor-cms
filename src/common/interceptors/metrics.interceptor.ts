import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { MetricsService } from '../services/metrics.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, route } = request;

    const routePath = route?.path || request.path || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = (Date.now() - startTime) / 1000; // Convert to seconds
        const statusCode = response.statusCode;

        // Record metrics
        this.metricsService.httpRequestDuration
          .labels(method, routePath, statusCode.toString())
          .observe(duration);

        this.metricsService.httpRequestTotal
          .labels(method, routePath, statusCode.toString())
          .inc();

        // Record errors (4xx and 5xx)
        if (statusCode >= 400) {
          this.metricsService.httpRequestErrors
            .labels(method, routePath, statusCode.toString())
            .inc();
        }
      }),
      catchError((error) => {
        const duration = (Date.now() - startTime) / 1000;
        const statusCode = error.status || 500;

        // Record error metrics
        this.metricsService.httpRequestDuration
          .labels(method, routePath, statusCode.toString())
          .observe(duration);

        this.metricsService.httpRequestTotal
          .labels(method, routePath, statusCode.toString())
          .inc();

        this.metricsService.httpRequestErrors
          .labels(method, routePath, statusCode.toString())
          .inc();

        throw error;
      }),
    );
  }
}
