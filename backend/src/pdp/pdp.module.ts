import { Module } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { PdpEngine } from './pdp.engine';
import { PdpTelemetryService } from './pdp.telemetry.service';
import { PdpActivationService } from './pdp.activation.service';
import { PdpActivationAdminService } from './pdp.activation.admin.service';
import { PdpExceptionService } from './pdp.exception.service';
import { PdpController } from './pdp.controller';
import { AuditModule } from '../core/audit/audit.module';
import { PdpOperationalGuardService } from './pdp-operational-guard.service';

@Module({
  imports: [AuditModule],
  controllers: [PdpController],
  providers: [
    PrismaService,
    PdpEngine,
    PdpTelemetryService,
    PdpActivationService,
    PdpActivationAdminService,
    PdpExceptionService,
    PdpOperationalGuardService,
  ],
  exports: [
    PdpEngine,
    PdpActivationService,
    PdpActivationAdminService,
    PdpExceptionService,
    PdpOperationalGuardService,
  ],
})
export class PdpModule {}
