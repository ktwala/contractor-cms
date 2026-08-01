import { Module } from '@nestjs/common';
import { PayrollResultsModule } from '../payroll-results/payroll-results.module';
import { StatutoryController } from './statutory.controller';
import { StatutoryService } from './statutory.service';
import { StatutoryProfileRegistry } from './statutory-profile.registry';
import { StatutoryValidationService } from './statutory-validation.service';
import { StatutoryReturnAggregationService } from './statutory-return-aggregation.service';
import { StatutoryReturnBuilderService } from './statutory-return-builder.service';
import { StatutoryEvidenceService } from './statutory-evidence.service';
import { StatutoryExportService } from './statutory-export.service';
import { StatutoryWorkflowService } from './statutory-workflow.service';
import { StatutoryRepository } from './repository/statutory.repository';

@Module({
  imports: [PayrollResultsModule],
  controllers: [StatutoryController],
  providers: [
    StatutoryService,
    StatutoryProfileRegistry,
    StatutoryValidationService,
    StatutoryReturnAggregationService,
    StatutoryReturnBuilderService,
    StatutoryEvidenceService,
    StatutoryExportService,
    StatutoryWorkflowService,
    StatutoryRepository,
  ],
  exports: [
    StatutoryService,
    StatutoryProfileRegistry,
  ],
})
export class PayrollStatutoryModule {}
