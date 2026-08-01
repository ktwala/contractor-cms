import { Module } from '@nestjs/common';
import { AuditModule } from '../../core/audit/audit.module';
import { OrgUnitManagerInferenceModule } from '../org-unit-manager-inference/org-unit-manager-inference.module';
import { EnterpriseController } from './enterprise.controller';
import { MultiCompanyConsolidationService } from './services/multi-company-consolidation.service';
import { ApprovalWorkflowService } from './services/approval-workflow.service';
import { AuditTrailService } from './services/audit-trail.service';
import { RbacService } from './services/rbac.service';
import { DataArchivingService } from './services/data-archiving.service';
import { DelegationService } from './services/delegation.service';
import { CostCenterService } from './services/cost-center.service';
import { OrgUnitService } from './services/org-unit.service';
import { EmploymentAssignmentService } from './services/employment-assignment.service';
import { PositionService } from './services/position.service';
import { BulkOperationsService } from './services/bulk-operations.service';
import { UserManagementService } from './services/user-management.service';

@Module({
  imports: [AuditModule, OrgUnitManagerInferenceModule],
  controllers: [EnterpriseController],
  providers: [
    MultiCompanyConsolidationService,
    ApprovalWorkflowService,
    AuditTrailService,
    RbacService,
    DataArchivingService,
    DelegationService,
    CostCenterService,
    OrgUnitService,
    EmploymentAssignmentService,
    PositionService,
    BulkOperationsService,
    UserManagementService,
  ],
  exports: [
    MultiCompanyConsolidationService,
    ApprovalWorkflowService,
    AuditTrailService,
    RbacService,
    DataArchivingService,
    DelegationService,
    CostCenterService,
    OrgUnitService,
    EmploymentAssignmentService,
    PositionService,
    BulkOperationsService,
    UserManagementService,
  ],
})
export class EnterpriseModule {}
