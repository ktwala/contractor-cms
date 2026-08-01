import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { WorkforceRemediationService } from './workforce-remediation.service';
import { WorkforceRemediationController } from './workforce-remediation.controller';

@Module({
  imports: [AuditModule],
  controllers: [WorkforceRemediationController],
  providers: [WorkforceRemediationService],
  exports: [WorkforceRemediationService],
})
export class WorkforceRemediationModule {}
