import { Module } from '@nestjs/common';
import { WorkforceReadinessService } from './workforce-readiness.service';

@Module({
  providers: [WorkforceReadinessService],
  exports: [WorkforceReadinessService],
})
export class WorkforceReadinessModule {}
