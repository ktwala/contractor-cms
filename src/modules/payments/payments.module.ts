import { Module, forwardRef } from '@nestjs/common';
import { PaymentBatchController } from './payment-batch.controller';
import { PaymentBatchService } from './payment-batch.service';
import { AuditModule } from '../../core/audit/audit.module';
import { PayrunsModule } from '../payruns/payruns.module';

@Module({
  imports: [AuditModule, forwardRef(() => PayrunsModule)],
  controllers: [PaymentBatchController],
  providers: [PaymentBatchService],
  exports: [PaymentBatchService],
})
export class PaymentsModule {}
