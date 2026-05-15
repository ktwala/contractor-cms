import { Module } from '@nestjs/common';
import { IgaEventBuilder } from './iga-event.builder';

@Module({
  providers: [IgaEventBuilder],
  exports: [IgaEventBuilder],
})
export class IgaModule {}
