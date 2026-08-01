import { Injectable } from '@nestjs/common';
import * as promClient from 'prom-client';

/**
 * Prometheus Metrics Service
 * 
 * Collects and exposes application metrics in Prometheus format
 */
@Injectable()
export class MetricsService {
  // HTTP Request Metrics
  public readonly httpRequestDuration: promClient.Histogram<string>;
  public readonly httpRequestTotal: promClient.Counter<string>;
  public readonly httpRequestErrors: promClient.Counter<string>;

  // Application Metrics
  public readonly activeConnections: promClient.Gauge<string>;
  public readonly databaseConnections: promClient.Gauge<string>;
  public readonly cacheHitRate: promClient.Counter<string>;
  public readonly cacheMissRate: promClient.Counter<string>;

  // Business Metrics
  public readonly payrunCalculations: promClient.Counter<string>;
  public readonly payrunErrors: promClient.Counter<string>;
  public readonly employeeCount: promClient.Gauge<string>;
  public readonly activePayruns: promClient.Gauge<string>;

  // Performance Metrics
  public readonly responseTime: promClient.Histogram<string>;
  public readonly databaseQueryDuration: promClient.Histogram<string>;

  constructor() {
    // Register default metrics (CPU, memory, etc.)
    promClient.collectDefaultMetrics({
      prefix: 'payroll_platform_',
      gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
    });

    // HTTP Request Duration Histogram
    this.httpRequestDuration = new promClient.Histogram({
      name: 'payroll_platform_http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    });

    // HTTP Request Total Counter
    this.httpRequestTotal = new promClient.Counter({
      name: 'payroll_platform_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
    });

    // HTTP Request Errors Counter
    this.httpRequestErrors = new promClient.Counter({
      name: 'payroll_platform_http_errors_total',
      help: 'Total number of HTTP errors',
      labelNames: ['method', 'route', 'status_code'],
    });

    // Active Connections Gauge
    this.activeConnections = new promClient.Gauge({
      name: 'payroll_platform_active_connections',
      help: 'Number of active connections',
    });

    // Database Connections Gauge
    this.databaseConnections = new promClient.Gauge({
      name: 'payroll_platform_database_connections',
      help: 'Number of database connections',
    });

    // Cache Hit/Miss Counters
    this.cacheHitRate = new promClient.Counter({
      name: 'payroll_platform_cache_hits_total',
      help: 'Total number of cache hits',
      labelNames: ['cache_type'],
    });

    this.cacheMissRate = new promClient.Counter({
      name: 'payroll_platform_cache_misses_total',
      help: 'Total number of cache misses',
      labelNames: ['cache_type'],
    });

    // Payrun Metrics
    this.payrunCalculations = new promClient.Counter({
      name: 'payroll_platform_payrun_calculations_total',
      help: 'Total number of payrun calculations',
      labelNames: ['status'],
    });

    this.payrunErrors = new promClient.Counter({
      name: 'payroll_platform_payrun_errors_total',
      help: 'Total number of payrun errors',
      labelNames: ['error_type'],
    });

    // Employee Count Gauge
    this.employeeCount = new promClient.Gauge({
      name: 'payroll_platform_employees_total',
      help: 'Total number of employees',
      labelNames: ['status', 'country'],
    });

    // Active Payruns Gauge
    this.activePayruns = new promClient.Gauge({
      name: 'payroll_platform_active_payruns',
      help: 'Number of active payruns',
      labelNames: ['status'],
    });

    // Response Time Histogram
    this.responseTime = new promClient.Histogram({
      name: 'payroll_platform_response_time_seconds',
      help: 'Response time in seconds',
      labelNames: ['endpoint'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });

    // Database Query Duration Histogram
    this.databaseQueryDuration = new promClient.Histogram({
      name: 'payroll_platform_database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    });
  }

  /**
   * Get metrics in Prometheus format
   */
  async getMetrics(): Promise<string> {
    return promClient.register.metrics();
  }

  /**
   * Get metrics content type
   */
  getContentType(): string {
    return promClient.register.contentType;
  }
}
