import { Module } from '@nestjs/common';
import { RunCenterController } from './run-center.controller';
import { RunCenterService } from './run-center.service';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [RunCenterController],
  providers: [RunCenterService],
  exports: [RunCenterService],
})
export class RunCenterModule {}
