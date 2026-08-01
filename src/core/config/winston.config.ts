import * as winston from 'winston';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

/**
 * Winston logger configuration for structured logging
 */
export const winstonConfig = {
  transports: [
    // Console transport with colored output
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
        nestWinstonModuleUtilities.format.nestLike('PayrollPlatform', {
          prettyPrint: process.env.NODE_ENV !== 'production',
          colors: true,
        }),
      ),
    }),
    // File transport for errors
    ...(process.env.NODE_ENV === 'production'
      ? [
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json(),
            ),
          }),
          // File transport for all logs
          new winston.transports.File({
            filename: 'logs/combined.log',
            format: winston.format.combine(
              winston.format.timestamp(),
              winston.format.errors({ stack: true }),
              winston.format.json(),
            ),
          }),
        ]
      : []),
  ],
  // Default log level
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  // Global default metadata
  defaultMeta: {
    service: 'workforce-platform',
    environment: process.env.NODE_ENV || 'development',
  },
};

/**
 * Create a Winston logger instance
 */
export function createWinstonLogger() {
  return winston.createLogger(winstonConfig);
}
