import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
  exports: [AnalyticsService],
})
export class AnalyticsModule {}
