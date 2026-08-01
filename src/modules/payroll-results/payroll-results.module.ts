import { Module } from '@nestjs/common';
import { PayrollResultsController } from './payroll-results.controller';
import { PayrollResultsService } from './payroll-results.service';
import { PayrollResultNormalizerService } from './payroll-result-normalizer.service';
import { PayrollDisplaySchemaRegistry } from './payroll-display-schema.registry';

@Module({
  controllers: [PayrollResultsController],
  providers: [
    PayrollResultsService,
    PayrollResultNormalizerService,
    PayrollDisplaySchemaRegistry,
  ],
  exports: [
    PayrollResultsService,
    PayrollResultNormalizerService,
    PayrollDisplaySchemaRegistry,
  ],
})
export class PayrollResultsModule {}
