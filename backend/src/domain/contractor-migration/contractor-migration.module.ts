import { Module, forwardRef } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { DatabaseModule } from '../../core/database/database.module';
import { HcmModule } from '../../core/hcm/hcm.module';
import { AccessIntegrationModule } from '../access-integration/access-integration.module';
import { SourceIntegrationModule } from '../../integration/source-integration.module';
import { OracleHcmModule } from '../../integration/oracle-hcm/oracle-hcm.module';
import { ContractorsModule } from '../contractors/contractors.module';
import { OracleHcmContractorSourceAdapter } from './adapters/oracle-hcm-contractor-source.adapter';
import { HcmContractorNormalizationService } from './services/hcm-contractor-normalization.service';
import { HcmStagingQuarantineService } from './services/hcm-staging-quarantine.service';
import { HcmStagingValidationService } from './services/hcm-staging-validation.service';
import { CtrSequenceService } from './services/ctr-sequence.service';
import { PromoteHcmContractorToCmsService } from './services/promote-hcm-contractor-to-cms.service';
import { PROMOTE_HCM_CONTRACTOR_TOKEN } from './contracts/promote-hcm-contractor.contract';
import { HcmContractorFileExtractParser } from './parsers/hcm-contractor-file-extract.parser';
import { HcmContractorStagingWriterService } from './services/hcm-contractor-staging-writer.service';
import { HcmOracleRestExtractProvider } from './providers/hcm-oracle-rest-extract.provider';
import { HcmContractorExtractAdapter } from './adapters/hcm-contractor-extract.adapter';
import { HcmMigrationWorkshopService } from './services/hcm-migration-workshop.service';
import { HcmMigrationAdminService } from './services/hcm-migration-admin.service';
import { ContractorMigrationAdminController } from './contractor-migration-admin.controller';

/**
 * PR-CTR-2B / PR-CTR-5 / PR-CTR-3 — migration control plane (extract → validate → promote).
 */
@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    HcmModule,
    AccessIntegrationModule,
    ContractorsModule,
    forwardRef(() => SourceIntegrationModule),
    OracleHcmModule,
  ],
  controllers: [ContractorMigrationAdminController],
  providers: [
    HcmContractorNormalizationService,
    HcmStagingQuarantineService,
    HcmStagingValidationService,
    CtrSequenceService,
    PromoteHcmContractorToCmsService,
    HcmContractorFileExtractParser,
    HcmContractorStagingWriterService,
    HcmOracleRestExtractProvider,
    HcmContractorExtractAdapter,
    OracleHcmContractorSourceAdapter,
    HcmMigrationWorkshopService,
    HcmMigrationAdminService,
    {
      provide: PROMOTE_HCM_CONTRACTOR_TOKEN,
      useExisting: PromoteHcmContractorToCmsService,
    },
  ],
  exports: [
    HcmContractorNormalizationService,
    HcmStagingQuarantineService,
    HcmStagingValidationService,
    CtrSequenceService,
    PromoteHcmContractorToCmsService,
    HcmContractorExtractAdapter,
    OracleHcmContractorSourceAdapter,
    HcmMigrationWorkshopService,
    HcmMigrationAdminService,
    HcmContractorFileExtractParser,
    PROMOTE_HCM_CONTRACTOR_TOKEN,
  ],
})
export class ContractorMigrationModule {}
