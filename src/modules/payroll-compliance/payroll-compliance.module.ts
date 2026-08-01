import { Module } from '@nestjs/common';
import { PayrollComplianceController } from './payroll-compliance.controller';
import { PayrollComplianceService } from './payroll-compliance.service';
import { AuditModule } from '../../core/audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [PayrollComplianceController],
  providers: [PayrollComplianceService],
  exports: [PayrollComplianceService],
})
export class PayrollComplianceModule {}
