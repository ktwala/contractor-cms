import { Module } from '@nestjs/common';
import { PayGroupsController } from './pay-groups.controller';
import { PayGroupsService } from './pay-groups.service';
import { PayPeriodsController } from './pay-periods.controller';
import { PayPeriodsService } from './pay-periods.service';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PayGroupsController, PayPeriodsController],
  providers: [PayGroupsService, PayPeriodsService],
  exports: [PayGroupsService, PayPeriodsService],
})
export class PayGroupsModule {}
