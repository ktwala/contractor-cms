import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { WorkforceRemediationModule } from '../workforce-remediation/workforce-remediation.module';
import { RemediationApprovalService } from './approval.service';
import { RemediationApprovalController } from './approval.controller';

@Module({
  imports: [AuditModule, WorkforceRemediationModule],
  controllers: [RemediationApprovalController],
  providers: [RemediationApprovalService],
  exports: [RemediationApprovalService],
})
export class WorkforceRemediationGovernanceModule {}
