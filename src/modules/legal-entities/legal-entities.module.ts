import { Module } from '@nestjs/common';
import { LegalEntitiesController } from './legal-entities.controller';
import { LegalEntitiesService } from './legal-entities.service';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [LegalEntitiesController],
  providers: [LegalEntitiesService],
  exports: [LegalEntitiesService],
})
export class LegalEntitiesModule {}
