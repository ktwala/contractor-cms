import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { HcmModule } from '../../core/hcm/hcm.module';
import { AccessIntegrationModule } from '../access-integration/access-integration.module';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule, HcmModule, AccessIntegrationModule],
  controllers: [EngagementsController],
  providers: [EngagementsService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
