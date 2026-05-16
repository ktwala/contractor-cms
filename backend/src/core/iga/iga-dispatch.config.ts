import { ConfigService } from '@nestjs/config';

export interface IgaDispatchConfig {
  enabled: boolean;
  intervalSeconds: number;
  batchSize: number;
}

/** PR-IGA-DISPATCH-SCHEDULER-1 — env-driven dispatch loop (disabled unless explicitly enabled). */
export function readIgaDispatchConfig(config: ConfigService): IgaDispatchConfig {
  const intervalRaw = Number(config.get<string>('IGA_DISPATCH_INTERVAL_SECONDS') ?? 60);
  const batchRaw = Number(config.get<string>('IGA_DISPATCH_BATCH_SIZE') ?? 25);

  return {
    enabled: config.get<string>('IGA_DISPATCH_ENABLED') === 'true',
    intervalSeconds: Number.isFinite(intervalRaw) && intervalRaw >= 1 ? intervalRaw : 60,
    batchSize: Number.isFinite(batchRaw) && batchRaw >= 1 ? batchRaw : 25,
  };
}
