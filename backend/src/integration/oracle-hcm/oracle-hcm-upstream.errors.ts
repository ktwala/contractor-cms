import { ServiceUnavailableException } from '@nestjs/common';

export type HcmOracleUpstreamFailureCode =
  | 'AUTH_FAILED'
  | 'RATE_LIMITED'
  | 'UPSTREAM_ERROR'
  | 'UPSTREAM_UNAVAILABLE';

export class HcmOracleUpstreamException extends ServiceUnavailableException {
  readonly upstreamCode: HcmOracleUpstreamFailureCode;
  readonly statusCode?: number;

  constructor(
    upstreamCode: HcmOracleUpstreamFailureCode,
    message: string,
    statusCode?: number,
  ) {
    super(message);
    this.upstreamCode = upstreamCode;
    this.statusCode = statusCode;
  }
}

export function classifyHcmOracleUpstreamError(err: unknown): {
  upstreamCode: HcmOracleUpstreamFailureCode;
  message: string;
  statusCode?: number;
} {
  if (err instanceof HcmOracleUpstreamException) {
    return {
      upstreamCode: err.upstreamCode,
      message: err.message,
      statusCode: err.statusCode,
    };
  }

  const message = err instanceof Error ? err.message : 'Upstream error';
  const lower = message.toLowerCase();

  if (lower.includes('auth') || lower.includes('401') || lower.includes('403')) {
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
