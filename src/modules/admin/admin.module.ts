import { Module } from '@nestjs/common';
import { TaxTablesAdminController } from './tax-tables-admin.controller';
import { StatutoryBootstrapReadinessController } from './statutory-bootstrap-readiness.controller';
import { StatutoryReadinessModule } from '../statutory-readiness/statutory-readiness.module';

@Module({
  imports: [StatutoryReadinessModule],
  controllers: [TaxTablesAdminController, StatutoryBootstrapReadinessController],
})
export class AdminModule { }
