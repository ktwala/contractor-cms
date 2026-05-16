import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readIgaDispatchConfig } from './iga-dispatch.config';
import { IgaOutboxDispatcherService } from './iga-outbox-dispatcher.service';

/**
 * PR-IGA-DISPATCH-SCHEDULER-1 — optional interval invocation of outbox dispatch.
 * Disabled by default (`IGA_DISPATCH_ENABLED` not `true`). No vendor connector or retry policy.
 */
@Injectable()
export class IgaDispatchSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IgaDispatchSchedulerService.name);
  private intervalRef?: ReturnType<typeof setInterval>;
  private running = false;

  constructor(
    private readonly config: ConfigService,
    private readonly dispatcher: IgaOutboxDispatcherService,
  ) {}

  onModuleInit(): void {
    const cfg = readIgaDispatchConfig(this.config);
    if (!cfg.enabled) {
      this.logger.log('IGA outbox dispatch scheduler is disabled (IGA_DISPATCH_ENABLED != true)');
      return;
    }

    const intervalMs = cfg.intervalSeconds * 1000;
    this.intervalRef = setInterval(() => {
      void this.tick();
    }, intervalMs);

    this.logger.log(
      `IGA outbox dispatch scheduler started (interval=${cfg.intervalSeconds}s batch=${cfg.batchSize})`,
    );
  }

  onModuleDestroy(): void {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = undefined;
    }
  }

  /** Single dispatch pass — callable from tests or manual ops. */
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const { batchSize } = readIgaDispatchConfig(this.config);
      const result = await this.dispatcher.processPending(batchSize);
      this.logger.log(
        `IGA outbox dispatch: processed=${result.processed} sent=${result.sent} failed=${result.failed}`,
      );
    } catch (err) {
      this.logger.error(
        'IGA outbox dispatch tick failed',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.running = false;
    }
  }
}
