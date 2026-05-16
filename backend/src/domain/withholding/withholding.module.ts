import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { WithholdingController } from './withholding.controller';
import { WithholdingService } from './withholding.service';
import { DatabaseModule } from '../../core/database/database.module';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [WithholdingController],
  providers: [WithholdingService],
  exports: [WithholdingService],
})
export class WithholdingModule {}
