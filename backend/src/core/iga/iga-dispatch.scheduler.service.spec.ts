import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { IgaDispatchSchedulerService } from './iga-dispatch.scheduler.service';
import { IgaOutboxDispatcherService } from './iga-outbox-dispatcher.service';

describe('IgaDispatchSchedulerService', () => {
  let scheduler: IgaDispatchSchedulerService;
  let processPending: jest.Mock;
  let logSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(async () => {
    processPending = jest.fn().mockResolvedValue({ processed: 2, sent: 1, failed: 1 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        IgaDispatchSchedulerService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              const env: Record<string, string> = {
                IGA_DISPATCH_ENABLED: 'true',
                IGA_DISPATCH_INTERVAL_SECONDS: '60',
                IGA_DISPATCH_BATCH_SIZE: '25',
              };
              return env[key];
            },
          },
        },
        {
          provide: IgaOutboxDispatcherService,
          useValue: { processPending },
        },
      ],
    }).compile();

    scheduler = moduleRef.get(IgaDispatchSchedulerService);
    logSpy = jest.spyOn((scheduler as any).logger, 'log').mockImplementation();
    errorSpy = jest.spyOn((scheduler as any).logger, 'error').mockImplementation();
  });

  afterEach(() => {
    scheduler.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('tick calls processPending with configured batch size', async () => {
    await scheduler.tick();

    expect(processPending).toHaveBeenCalledWith(25);
  });

  it('tick logs dispatch counts only', async () => {
    await scheduler.tick();

    expect(logSpy).toHaveBeenCalledWith(
      'IGA outbox dispatch: processed=2 sent=1 failed=1',
    );
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('tick logs error when processPending throws', async () => {
    processPending.mockRejectedValue(new Error('db down'));

    await scheduler.tick();

    expect(errorSpy).toHaveBeenCalledWith(
      'IGA outbox dispatch tick failed',
      expect.any(String),
    );
  });

  it('onModuleInit does not start interval when disabled', () => {
    const disabled = new IgaDispatchSchedulerService(
      { get: () => undefined } as unknown as ConfigService,
      { processPending } as unknown as IgaOutboxDispatcherService,
    );
    const log = jest.spyOn((disabled as any).logger, 'log').mockImplementation();

    disabled.onModuleInit();

    expect((disabled as any).intervalRef).toBeUndefined();
    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('disabled'),
    );
    disabled.onModuleDestroy();
  });
});
