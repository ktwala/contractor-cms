import { ServiceUnavailableException } from '@nestjs/common';

export type OracleUpstreamFailureCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_UNAVAILABLE';

/**
 * PR-CMS-CONNECTOR-1D — typed upstream failure for connector health mapping.
 */
export class OracleProcurementUpstreamException extends ServiceUnavailableException {
  readonly upstreamCode: OracleUpstreamFailureCode;
  readonly statusCode?: number;

  constructor(
    upstreamCode: OracleUpstreamFailureCode,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.upstreamCode = upstreamCode;
    this.statusCode = statusCode;
  }
}

export function classifyOracleUpstreamError(err: unknown): {
  upstreamCode: OracleUpstreamFailureCode;
  message: string;
  statusCode?: number;
} {
  if (err instanceof OracleProcurementUpstreamException) {
    return {
      upstreamCode: err.upstreamCode,
      message: err.message,
      statusCode: err.statusCode,
    };
  }

  const message = err instanceof Error ? err.message : 'Upstream error';
  const lower = message.toLowerCase();

  if (lower.includes('auth failed') || lower.includes('401') || lower.includes('403')) {
    return { upstreamCode: 'AUTH_FAILED', message };
  }
  if (lower.includes('rate limit') || lower.includes('429')) {
    return { upstreamCode: 'RATE_LIMITED', message };
  }
  if (
    lower.includes('network') ||
    lower.includes('timeout') ||
    lower.includes('request failed')
  ) {
    return { upstreamCode: 'UPSTREAM_UNAVAILABLE', message };
  }
  return { upstreamCode: 'UPSTREAM_ERROR', message };
}
