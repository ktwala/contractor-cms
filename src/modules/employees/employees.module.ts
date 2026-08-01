import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { EmploymentsController } from './employments.controller';
import { EmploymentsService } from './employments.service';
import { EffectiveDatedService } from './effective-dated.service';
import { RecurringInputsService } from './recurring-inputs.service';
import { AuditModule } from '../../core/audit/audit.module';
import { EnterpriseModule } from '../enterprise/enterprise.module';

@Module({
  imports: [AuditModule, EnterpriseModule],
  controllers: [EmployeesController, EmploymentsController],
  providers: [
    EmployeesService,
    EmploymentsService,
    EffectiveDatedService,
    RecurringInputsService,
  ],
  exports: [
    EmployeesService,
    EmploymentsService,
    EffectiveDatedService,
    RecurringInputsService,
  ],
})
export class EmployeesModule {}
