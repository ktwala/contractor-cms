import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { TaxTableImpactAnalysisController } from './tax-table-impact-analysis.controller';
import { TaxTableImpactAnalysisService } from './tax-table-impact-analysis.service';
import { TaxTableImpactAnalysisBasisService } from './tax-table-impact-analysis-basis.service';
import { TaxTableImpactAnalysisSummaryService } from './tax-table-impact-analysis-summary.service';
import { TaxTableImpactAnalysisMapper } from './tax-table-impact-analysis.mapper';
import { TaxTableImpactAnalysisRunRepository } from './tax-table-impact-analysis-run.repository';
import { TaxTableImpactAnalysisExportService } from './tax-table-impact-analysis-export.service';
import { TaxTableImpactAnalysisReviewService } from './tax-table-impact-analysis-review.service';
import { TaxTableImpactAnalysisReadinessService } from './tax-table-impact-analysis-readiness.service';

@Module({
  imports: [DatabaseModule],
  controllers: [TaxTableImpactAnalysisController],
  providers: [
    TaxTableImpactAnalysisService,
    TaxTableImpactAnalysisBasisService,
    TaxTableImpactAnalysisSummaryService,
    TaxTableImpactAnalysisMapper,
    TaxTableImpactAnalysisRunRepository,
    TaxTableImpactAnalysisExportService,
    TaxTableImpactAnalysisReviewService,
    TaxTableImpactAnalysisReadinessService,
  ],
  exports: [
    TaxTableImpactAnalysisService,
    TaxTableImpactAnalysisReadinessService,
  ],
})
export class TaxTableImpactAnalysisModule {}
