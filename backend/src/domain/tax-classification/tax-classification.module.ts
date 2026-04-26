import { Module } from '@nestjs/common';
import { TaxClassificationController } from './tax-classification.controller';
import { TaxClassificationService } from './tax-classification.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TaxClassificationController],
  providers: [TaxClassificationService],
  exports: [TaxClassificationService],
})
export class TaxClassificationModule {}
