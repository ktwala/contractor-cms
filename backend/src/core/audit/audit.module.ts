import { Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuditController } from './audit.controller';
import { AuditInsightsService } from './audit-insights.service';
import { AuditInsightsController } from './audit-insights.controller';

@Module({
  controllers: [AuditController, AuditInsightsController],
  providers: [AuditService, AuditInsightsService],
  exports: [AuditService],
})
export class AuditModule {}
