import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { ContractorMigrationModule } from '../contractor-migration/contractor-migration.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { DemoHcmStagingMaterializationService } from './demo-hcm-staging-materialization.service';
import { DemoSupplierSetupService } from './demo-supplier-setup.service';

@Module({
  imports: [DatabaseModule, AuditModule, ContractorMigrationModule, SuppliersModule],
  providers: [DemoHcmStagingMaterializationService, DemoSupplierSetupService],
  exports: [DemoHcmStagingMaterializationService, DemoSupplierSetupService],
})
export class DemoModule {}
