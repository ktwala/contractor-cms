import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierLifecycleService } from './supplier-lifecycle.service';
import { SupplierEvidenceChecklistService } from './supplier-evidence-checklist.service';
import { SupplierDocumentsService } from './supplier-documents.service';
import { SupplierGovernanceDashboardService } from './supplier-governance-dashboard.service';
import { SupplierOperationalTrustService } from './supplier-operational-trust.service';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { AuthorityModule } from '../../core/authority/authority.module';

@Module({
  imports: [DatabaseModule, AuditModule, AuthorityModule],
  controllers: [SuppliersController],
  providers: [
    SuppliersService,
    SupplierLifecycleService,
    SupplierEvidenceChecklistService,
    SupplierDocumentsService,
    SupplierGovernanceDashboardService,
    SupplierOperationalTrustService,
  ],
  exports: [
    SuppliersService,
    SupplierLifecycleService,
    SupplierEvidenceChecklistService,
    SupplierDocumentsService,
    SupplierGovernanceDashboardService,
    SupplierOperationalTrustService,
  ],
})
export class SuppliersModule {}
