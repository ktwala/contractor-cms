import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { AuditModule } from '../../core/audit/audit.module';
import { AuthModule } from '../../core/auth/auth.module';
import { IgaModule } from '../../core/iga/iga.module';
import { SupplierPortalController } from './supplier-portal.controller';
import { SupplierPortalService } from './supplier-portal.service';
import { SupplierPortalScopeGuard } from './guards/supplier-portal-scope.guard';

@Module({
  imports: [DatabaseModule, AuditModule, AuthModule, IgaModule],
  controllers: [SupplierPortalController],
  providers: [SupplierPortalService, SupplierPortalScopeGuard],
})
export class SupplierPortalModule {}
