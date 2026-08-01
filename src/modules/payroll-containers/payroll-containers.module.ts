import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { DatabaseModule } from '../../core/database/database.module';
import { PayrollContainersController } from './payroll-containers.controller';
import { PayrollContainersService } from './payroll-containers.service';

@Module({
  imports: [DatabaseModule, AuditModule],
  controllers: [PayrollContainersController],
  providers: [PayrollContainersService],
  exports: [PayrollContainersService],
})
export class PayrollContainersModule {}
