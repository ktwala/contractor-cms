import { Module } from '@nestjs/common';
import { IgaEventBuilder } from './iga-event.builder';
import { IgaOutboxService } from './iga-outbox.service';
import { IgaWorkforceEventWriter } from './iga-workforce-event-writer.service';

@Module({
  providers: [IgaEventBuilder, IgaOutboxService, IgaWorkforceEventWriter],
  exports: [IgaEventBuilder, IgaOutboxService, IgaWorkforceEventWriter],
})
export class IgaModule {}
