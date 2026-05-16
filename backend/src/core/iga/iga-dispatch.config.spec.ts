import { ConfigService } from '@nestjs/config';
import { readIgaDispatchConfig } from './iga-dispatch.config';

describe('readIgaDispatchConfig', () => {
  const config = (env: Record<string, string | undefined>) =>
    ({
      get: (key: string) => env[key],
    }) as ConfigService;

  it('defaults to disabled with 60s interval and batch 25', () => {
    expect(readIgaDispatchConfig(config({}))).toEqual({
      enabled: false,
      intervalSeconds: 60,
      batchSize: 25,
    });
  });

  it('enables only when IGA_DISPATCH_ENABLED is true', () => {
    expect(
      readIgaDispatchConfig(config({ IGA_DISPATCH_ENABLED: 'true' })).enabled,
    ).toBe(true);
    expect(
      readIgaDispatchConfig(config({ IGA_DISPATCH_ENABLED: 'false' })).enabled,
    ).toBe(false);
  });

  it('reads interval and batch size from env', () => {
    expect(
      readIgaDispatchConfig(
        config({
          IGA_DISPATCH_INTERVAL_SECONDS: '120',
          IGA_DISPATCH_BATCH_SIZE: '10',
        }),
      ),
    ).toEqual({
      enabled: false,
      intervalSeconds: 120,
      batchSize: 10,
    });
  });
});
