import { Module } from '@nestjs/common';
import { IgaEventBuilder } from './iga-event.builder';
import { IgaOutboxService } from './iga-outbox.service';

@Module({
  providers: [IgaEventBuilder, IgaOutboxService],
  exports: [IgaEventBuilder, IgaOutboxService],
})
export class IgaModule {}
