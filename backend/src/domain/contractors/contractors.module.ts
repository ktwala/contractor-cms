import { Module } from '@nestjs/common';
import { ContractorsController } from './contractors.controller';
import { ContractorsService } from './contractors.service';
import { ContractorWorkforceStateService } from './contractor-workforce-state.service';
import { ContractorWorkforceHistoryService } from './contractor-workforce-history.service';
import { ContractorWorkforceEventPublisherService } from './contractor-workforce-event-publisher.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { AccessIntegrationModule } from '../access-integration/access-integration.module';
import { HcmModule } from '../../core/hcm/hcm.module';

@Module({
  imports: [DatabaseModule, AuditModule, AccessIntegrationModule, HcmModule],
  controllers: [ContractorsController],
  providers: [
    ContractorsService,
    ContractorWorkforceStateService,
    ContractorWorkforceEventPublisherService,
    ContractorWorkforceHistoryService,
  ],
  exports: [ContractorsService, ContractorWorkforceStateService, ContractorWorkforceHistoryService],
})
export class ContractorsModule {}
