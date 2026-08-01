import { Module } from '@nestjs/common';
import { WorkforceStatsService } from './workforce-stats.service';
import { WorkforceStatsController } from './workforce-stats.controller';
import { WorkforceIssuesModule } from '../workforce-issues/workforce-issues.module';
import { WorkforceReadinessModule } from '../workforce-readiness/workforce-readiness.module';
import { OrgUnitManagerInferenceModule } from '../org-unit-manager-inference/org-unit-manager-inference.module';

@Module({
  imports: [WorkforceIssuesModule, WorkforceReadinessModule, OrgUnitManagerInferenceModule],
  controllers: [WorkforceStatsController],
  providers: [WorkforceStatsService],
  exports: [WorkforceStatsService],
})
export class WorkforceStatsModule {}
