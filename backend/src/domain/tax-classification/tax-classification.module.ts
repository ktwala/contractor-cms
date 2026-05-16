import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { TaxClassificationController } from './tax-classification.controller';
import { TaxClassificationService } from './tax-classification.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [TaxClassificationController],
  providers: [TaxClassificationService],
  exports: [TaxClassificationService],
})
export class TaxClassificationModule {}
