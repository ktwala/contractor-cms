import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

/**
 * Initialize Sentry for error tracking and performance monitoring
 */
export function initSentry(dsn?: string, environment?: string) {
  if (!dsn) {
    console.warn('Sentry DSN not provided, error tracking disabled');
    return;
  }

  Sentry.init({
    dsn,
    environment: environment || process.env.NODE_ENV || 'development',
    integrations: [
      nodeProfilingIntegration(),
    ],
    // Performance Monitoring
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Set sampling rate for profiling - this is relative to tracesSampleRate
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    // Filter sensitive data
    beforeSend(event, hint) {
      // Filter out sensitive headers
      if (event.request?.headers) {
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        sensitiveHeaders.forEach((header) => {
          if (event.request?.headers) {
            delete event.request.headers[header.toLowerCase()];
          }
        });
      }
      return event;
    },
    // Ignore certain errors
    ignoreErrors: [
      // Browser extensions
      'top.GLOBALS',
      'originalCreateNotification',
      'canvas.contentDocument',
      'MyApp_RemoveAllHighlights',
      'atomicFindClose',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // Validation errors (already logged)
      'Validation failed',
    ],
  });
}
