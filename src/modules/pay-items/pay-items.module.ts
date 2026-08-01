import { Module } from '@nestjs/common';
import { PayItemsController } from './pay-items.controller';
import { PayItemsService } from './pay-items.service';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PayItemsController],
  providers: [PayItemsService],
  exports: [PayItemsService],
})
export class PayItemsModule {}
