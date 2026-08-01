import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { ContractorGovernanceRemediationController } from './contractor-governance-remediation.controller';
import { ContractorGovernanceRemediationService } from './contractor-governance-remediation.service';
import { ContractorGovernanceRemediationOrchestratorService } from './contractor-governance-remediation-orchestrator.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [ContractorGovernanceRemediationController],
  providers: [
    ContractorGovernanceRemediationService,
    ContractorGovernanceRemediationOrchestratorService,
  ],
  exports: [
    ContractorGovernanceRemediationService,
    ContractorGovernanceRemediationOrchestratorService,
  ],
})
export class ContractorGovernanceModule {}
