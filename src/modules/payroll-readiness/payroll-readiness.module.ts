import { Module } from '@nestjs/common';
import { PayrollReadinessController } from './payroll-readiness.controller';
import { PayrollReadinessService } from './payroll-readiness.service';
import { StatutoryReadinessModule } from '../statutory-readiness/statutory-readiness.module';

@Module({
  imports: [StatutoryReadinessModule],
  controllers: [PayrollReadinessController],
  providers: [PayrollReadinessService],
  exports: [PayrollReadinessService],
})
export class PayrollReadinessModule {}
