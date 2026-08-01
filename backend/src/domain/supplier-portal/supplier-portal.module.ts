import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { AuthModule } from '../../core/auth/auth.module';
import { IgaModule } from '../../core/iga/iga.module';
import { PdpModule } from '../../pdp/pdp.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ContractorsModule } from '../contractors/contractors.module';
import { SupplierPortalController } from './supplier-portal.controller';
import { SupplierPortalService } from './supplier-portal.service';
import { SupplierPortalScopeGuard } from './guards/supplier-portal-scope.guard';

@Module({
  imports: [
    DatabaseModule,
    AuditModule,
    AuthModule,
    IgaModule,
    PdpModule,
    SuppliersModule,
    ContractorsModule,
  ],
  controllers: [SupplierPortalController],
  providers: [SupplierPortalService, SupplierPortalScopeGuard],
})
export class SupplierPortalModule {}
