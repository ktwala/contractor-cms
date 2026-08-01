import { applyDecorators } from '@nestjs/common';
import { ApiHeader } from '@nestjs/swagger';

export function ApiIdempotencyKey() {
  return applyDecorators(
    ApiHeader({
      name: 'Idempotency-Key',
      description: 'Unique key to ensure idempotent requests',
      required: false,
      example: '7b6f9e8a-2b44-4c68-9b4b-4de1a7c1a8c0',
    }),
  );
}

export function ApiReasonHeader() {
  return applyDecorators(
    ApiHeader({
      name: 'X-Reason',
      description: 'Reason for the action (for audit trail)',
      required: false,
      example: 'Monthly payroll processing',
    }),
  );
}

export function ApiPayrollHeaders() {
  return applyDecorators(ApiIdempotencyKey(), ApiReasonHeader());
}
