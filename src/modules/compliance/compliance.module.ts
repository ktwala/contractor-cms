import { Module } from '@nestjs/common';
import { ComplianceController } from './compliance.controller';
import { StatutoryComplianceController } from './statutory-compliance.controller';
import { ComplianceService } from './compliance.service';
import { UifService } from './services/uif.service';
import { SdlService } from './services/sdl.service';
import { CoidaService } from './services/coida.service';
import { GarnishmentService } from './services/garnishment.service';
import { ComplianceDashboardService } from './services/compliance-dashboard.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [ComplianceController, StatutoryComplianceController],
  providers: [
    ComplianceService,
    UifService,
    SdlService,
    CoidaService,
    GarnishmentService,
    ComplianceDashboardService,
  ],
  exports: [
    ComplianceService,
    UifService,
    SdlService,
    CoidaService,
    GarnishmentService,
    ComplianceDashboardService,
  ],
})
export class ComplianceModule {}
