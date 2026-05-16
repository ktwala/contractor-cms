import { Module } from '@nestjs/common';
import { IGA_DELIVERY_PROVIDER } from './iga-delivery-provider.interface';
import { IgaDeliveryProviderStub } from './iga-delivery-provider.stub';
import { IgaEventBuilder } from './iga-event.builder';
import { IgaDispatchSchedulerService } from './iga-dispatch.scheduler.service';
import { IgaOutboxDispatcherService } from './iga-outbox-dispatcher.service';
import { IgaOutboxService } from './iga-outbox.service';
import { IgaWorkforceEventWriter } from './iga-workforce-event-writer.service';

@Module({
  providers: [
    IgaEventBuilder,
    IgaOutboxService,
    IgaWorkforceEventWriter,
    IgaOutboxDispatcherService,
    IgaDispatchSchedulerService,
    {
      provide: IGA_DELIVERY_PROVIDER,
      useClass: IgaDeliveryProviderStub,
    },
  ],
  exports: [
    IgaEventBuilder,
    IgaOutboxService,
    IgaWorkforceEventWriter,
    IgaOutboxDispatcherService,
    IgaDispatchSchedulerService,
    IGA_DELIVERY_PROVIDER,
  ],
})
export class IgaModule {}
