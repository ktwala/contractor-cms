import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { DatabaseModule } from '../../core/database/database.module';
import { OrgUnitManagerInferenceModule } from '../org-unit-manager-inference/org-unit-manager-inference.module';
import { DataImportsController } from './data-imports.controller';
import { DataImportsService } from './data-imports.service';
import { ImportPipelineService } from './import-pipeline.service';
import { LegalEntitiesValidator } from './validators/legal-entities.validator';
import { OrgUnitsValidator } from './validators/org-units.validator';
import { CostCentersValidator } from './validators/cost-centers.validator';
import { EmployeesValidator } from './validators/employees.validator';
import { EmploymentsValidator } from './validators/employments.validator';
import { EmploymentAssignmentsValidator } from './validators/employment-assignments.validator';
import { EmployeeManagersValidator } from './validators/employee-managers.validator';
import { PayGroupsValidator } from './validators/pay-groups.validator';
import { PositionsValidator } from './validators/positions.validator';
import { LegalEntitiesPublisher } from './publishers/legal-entities.publisher';
import { OrgUnitsPublisher } from './publishers/org-units.publisher';
import { CostCentersPublisher } from './publishers/cost-centers.publisher';
import { EmployeesPublisher } from './publishers/employees.publisher';
import { EmploymentsPublisher } from './publishers/employments.publisher';
import { EmploymentAssignmentsPublisher } from './publishers/employment-assignments.publisher';
import { EmployeeManagersPublisher } from './publishers/employee-managers.publisher';
import { PayGroupsPublisher } from './publishers/pay-groups.publisher';
import { PositionsPublisher } from './publishers/positions.publisher';
import { PayrollSupplementalImportService } from './payroll-supplemental/payroll-supplemental-import.service';
import { PayrollSupplementalImportController } from './payroll-supplemental/payroll-supplemental-import.controller';
import { PayrollOpeningBalancesImportService } from './payroll-opening-balances/payroll-opening-balances-import.service';
import { PayrollOpeningBalancesImportController } from './payroll-opening-balances/payroll-opening-balances-import.controller';

@Module({
  imports: [DatabaseModule, AuditModule, OrgUnitManagerInferenceModule],
  controllers: [
    DataImportsController,
    PayrollSupplementalImportController,
    PayrollOpeningBalancesImportController,
  ],
  providers: [
    DataImportsService,
    ImportPipelineService,
    PayrollSupplementalImportService,
    PayrollOpeningBalancesImportService,
    LegalEntitiesValidator,
    OrgUnitsValidator,
    CostCentersValidator,
    EmployeesValidator,
    EmploymentsValidator,
    EmploymentAssignmentsValidator,
    EmployeeManagersValidator,
    PayGroupsValidator,
    PositionsValidator,
    LegalEntitiesPublisher,
    OrgUnitsPublisher,
    CostCentersPublisher,
    EmployeesPublisher,
    EmploymentsPublisher,
    EmploymentAssignmentsPublisher,
    EmployeeManagersPublisher,
    PayGroupsPublisher,
    PositionsPublisher,
  ],
  exports: [DataImportsService, ImportPipelineService, PayrollSupplementalImportService, PayrollOpeningBalancesImportService],
})
export class DataImportsModule {}
