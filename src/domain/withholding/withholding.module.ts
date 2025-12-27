import { Module } from '@nestjs/common';
import { WithholdingController } from './withholding.controller';
import { WithholdingService } from './withholding.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [WithholdingController],
  providers: [WithholdingService],
  exports: [WithholdingService],
})
export class WithholdingModule {}
