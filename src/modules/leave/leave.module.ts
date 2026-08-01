import { Module } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { LeaveController, LeaveSelfServiceController } from './leave.controller';
import { DatabaseModule } from '../../core/database/database.module';
import { LeavePackRegistry } from '../../country-packs/leave-pack.registry';
import { ZALeavePack } from '../../country-packs/south-africa/leave/za-leave.pack';
import { LSLeavePack } from '../../country-packs/lesotho/leave/ls-leave.pack';

@Module({
  imports: [DatabaseModule],
  controllers: [LeaveController, LeaveSelfServiceController],
  providers: [
    LeaveService,
    LeavePackRegistry,
    ZALeavePack,
    LSLeavePack,
  ],
  exports: [LeaveService, LeavePackRegistry],
})
export class LeaveModule {}
