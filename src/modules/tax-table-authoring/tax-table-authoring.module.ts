import { Module, forwardRef } from '@nestjs/common';
import { DatabaseModule } from '../../core/database/database.module';
import { TaxTableAuthoringController } from './tax-table-authoring.controller';
import { TaxTableAuthoringService } from './tax-table-authoring.service';
import { TaxTableAuthoringValidationService } from './tax-table-authoring.validation.service';
import { TaxTableAuthoringDiffService } from './tax-table-authoring.diff.service';
import { TaxTableAuthoringSimulationService } from './tax-table-authoring.simulation.service';
import { TaxTablePublishProjectionService } from './tax-table-publish-projection.service';
import { TaxTableTemplateRegistry } from './tax-table-template.registry';
import { TaxTableImportTemplateMapperService } from './services/tax-table-import-template-mapper.service';
import { TaxTableImpactAnalysisModule } from '../tax-table-impact-analysis/tax-table-impact-analysis.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => TaxTableImpactAnalysisModule),
  ],
  controllers: [TaxTableAuthoringController],
  providers: [
    TaxTableAuthoringService,
    TaxTableAuthoringValidationService,
    TaxTableAuthoringDiffService,
    TaxTableAuthoringSimulationService,
    TaxTablePublishProjectionService,
    TaxTableTemplateRegistry,
    TaxTableImportTemplateMapperService,
  ],
  exports: [
    TaxTableAuthoringService,
    TaxTableAuthoringValidationService,
    TaxTablePublishProjectionService,
    TaxTableTemplateRegistry,
  ],
})
export class TaxTableAuthoringModule {}
