import { Module } from '@nestjs/common';
import { HcmModule } from '../../core/hcm/hcm.module';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, HcmModule],
  controllers: [EngagementsController],
  providers: [EngagementsService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
