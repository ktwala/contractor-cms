import { Module } from '@nestjs/common';
import { EngagementsController } from './engagements.controller';
import { EngagementsService } from './engagements.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EngagementsController],
  providers: [EngagementsService],
  exports: [EngagementsService],
})
export class EngagementsModule {}
