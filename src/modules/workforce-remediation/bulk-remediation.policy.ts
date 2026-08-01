import { BadRequestException } from '@nestjs/common';

export const MAX_BATCH_SIZE = 200;

export function assertBatchSize(count: number) {
  if (count > MAX_BATCH_SIZE) {
    throw new BadRequestException(
      `Batch size ${count} exceeds maximum of ${MAX_BATCH_SIZE}. Apply narrower filters.`,
    );
  }
}

export function assertFixField(fix: Record<string, unknown>, required: string) {
  if (!fix[required]) {
    throw new BadRequestException(`Missing required fix field: ${required}`);
  }
}
