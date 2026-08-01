import { Module, forwardRef } from '@nestjs/common';
import { AuthorityModule } from '../core/authority/authority.module';
import { ContractorMigrationModule } from '../domain/contractor-migration/contractor-migration.module';
import { OracleProcurementModule } from './oracle-procurement/oracle-procurement.module';
import { OracleHcmModule } from './oracle-hcm/oracle-hcm.module';
import { SupplierSourcesModule } from '../domain/supplier-sources/supplier-sources.module';
import { ContractorSourcesModule } from '../domain/contractor-sources/contractor-sources.module';
import { SourceAdapterRegistry } from './source-adapter.registry';
import { SourceIntegrationService } from './source-integration.service';

@Module({
  imports: [
    AuthorityModule,
    OracleProcurementModule,
    OracleHcmModule,
    forwardRef(() => SupplierSourcesModule),
    forwardRef(() => ContractorMigrationModule),
    forwardRef(() => ContractorSourcesModule),
  ],
  providers: [SourceAdapterRegistry, SourceIntegrationService],
  exports: [SourceAdapterRegistry, SourceIntegrationService],
})
export class SourceIntegrationModule {}
