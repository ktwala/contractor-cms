import { Module } from '@nestjs/common';
import { SelfServiceController } from './self-service.controller';
import { SelfServiceService } from './self-service.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [SelfServiceController],
  providers: [SelfServiceService],
  exports: [SelfServiceService],
})
export class SelfServiceModule {}
