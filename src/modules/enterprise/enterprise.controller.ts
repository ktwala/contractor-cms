import { Controller, Get, Post, Put, Patch, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { MultiCompanyConsolidationService, CompanyGroup, GroupMember, ConsolidatedPayroll } from './services/multi-company-consolidation.service';
import { ApprovalWorkflowService, ApprovalRequest } from './services/approval-workflow.service';
import { AuditTrailService } from './services/audit-trail.service';
import { RbacService } from './services/rbac.service';
import { DataArchivingService, ArchiveResult } from './services/data-archiving.service';
import { DelegationService, Delegation } from './services/delegation.service';
import { CostCenterService, CostCenter } from './services/cost-center.service';
import { OrgUnitService } from './services/org-unit.service';
import { EmploymentAssignmentService } from './services/employment-assignment.service';
import { PositionService } from './services/position.service';
import { BulkOperationsService, BatchJobResult } from './services/bulk-operations.service';
import { AuthGuard } from '@nestjs/passport';
import { Permissions, AnyPermissions } from '../../common/decorators/permissions.decorator';
import { UserManagementService } from './services/user-management.service';

@Controller('api/enterprise')
@UseGuards(AuthGuard('jwt'))
export class EnterpriseController {
  constructor(
    private readonly multiCompanyService: MultiCompanyConsolidationService,
    private readonly approvalWorkflowService: ApprovalWorkflowService,
    private readonly auditTrailService: AuditTrailService,
    private readonly rbacService: RbacService,
    private readonly dataArchivingService: DataArchivingService,
    private readonly delegationService: DelegationService,
    private readonly costCenterService: CostCenterService,
    private readonly orgUnitService: OrgUnitService,
    private readonly employmentAssignmentService: EmploymentAssignmentService,
    private readonly positionService: PositionService,
    private readonly bulkOperationsService: BulkOperationsService,
    private readonly userManagementService: UserManagementService,
  ) { }

  // ==========================================
  // MULTI-COMPANY CONSOLIDATION ENDPOINTS
  // ==========================================

  @Post('groups')
  @Permissions('admin:groups:create')
  async createCompanyGroup(@Body() body: any, @Request() req: any) {
    const groupId = await this.multiCompanyService.createCompanyGroup(
      body.group_name,
      body.group_code,
      body.consolidation_currency || 'ZAR',
      body.parent_group_id || null,
      req.user.sub,
    );
    return { group_id: groupId };
  }

  @Post('groups/:groupId/members')
  @Permissions('admin:groups:manage')
  async addEntityToGroup(@Param('groupId') groupId: string, @Body() body: any) {
    const memberId = await this.multiCompanyService.addEntityToGroup(
      groupId,
      body.legal_entity_id,
      body.effective_from,
      body.consolidation_percentage || 100,
      body.effective_to || null,
    );
    return { member_id: memberId };
  }

  @Get('groups/:groupId/members')
  @Permissions('admin:groups:view')
  async getGroupMembers(@Param('groupId') groupId: string): Promise<GroupMember[]> {
    return this.multiCompanyService.getGroupMembers(groupId);
  }

  @Get('groups/:groupId/consolidated-payroll')
  @Permissions('payroll:reports:view')
  async getConsolidatedPayroll(@Param('groupId') groupId: string, @Query('period') period: string): Promise<ConsolidatedPayroll> {
    return this.multiCompanyService.getConsolidatedPayroll(groupId, period);
  }

  @Get('groups/:groupId/consolidated-compliance')
  @Permissions('compliance:reports:view')
  async getConsolidatedCompliance(@Param('groupId') groupId: string, @Query('period') period: string) {
    return this.multiCompanyService.getConsolidatedCompliance(groupId, period);
  }

  @Get('groups/:groupId/headcount')
  @Permissions('reports:headcount:view')
  async getConsolidatedHeadcount(@Param('groupId') groupId: string) {
    return this.multiCompanyService.getConsolidatedHeadcount(groupId);
  }

  @Get('groups')
  @Permissions('admin:groups:view')
  async getAllGroups(): Promise<CompanyGroup[]> {
    return this.multiCompanyService.getAllGroups();
  }

  @Put('groups/:groupId')
  @Permissions('admin:groups:manage')
  async updateCompanyGroup(
    @Param('groupId') groupId: string,
    @Body() body: { group_name: string; group_code: string; consolidation_currency?: string },
  ) {
    await this.multiCompanyService.updateCompanyGroup(
      groupId,
      body.group_name,
      body.group_code,
      (body.consolidation_currency as 'ZAR' | 'LSL') || 'ZAR',
    );
    return { status: 'updated' };
  }

  @Delete('groups/:groupId')
  @Permissions('admin:groups:manage')
  async deleteCompanyGroup(@Param('groupId') groupId: string) {
    await this.multiCompanyService.deleteCompanyGroup(groupId);
    return { status: 'deleted' };
  }

  // ==========================================
  // APPROVAL WORKFLOW ENDPOINTS
  // ==========================================

  @Post('workflows')
  @Permissions('admin:workflows:create')
  async createWorkflow(@Body() body: any, @Request() req: any) {
    const workflowId = await this.approvalWorkflowService.createWorkflow(
      body.workflow_name,
      body.workflow_type,
      body.legal_entity_id || null,
      body.steps,
      req.user.sub,
      body.config,
    );
    return { workflow_id: workflowId };
  }

  @Post('approval-requests')
  @Permissions('workflows:requests:create')
  async submitApprovalRequest(@Body() body: any, @Request() req: any) {
    const requestId = await this.approvalWorkflowService.submitApprovalRequest(
      body.workflow_id,
      body.request_type,
      body.entity_type,
      body.entity_id,
      body.legal_entity_id,
      body.request_data,
      body.total_amount || null,
      body.reason,
      req.user.sub,
      body.priority || 'medium',
    );
    return { request_id: requestId };
  }

  @Post('approval-requests/:requestId/approve')
  @Permissions('workflows:requests:approve')
  async approveRequest(
    @Param('requestId') requestId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const result = await this.approvalWorkflowService.approveRequest(
      requestId,
      req.user.sub,
      body.comments || null,
    );
    return result;
  }

  @Post('approval-requests/:requestId/reject')
  @Permissions('workflows:requests:approve')
  async rejectRequest(
    @Param('requestId') requestId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.approvalWorkflowService.rejectRequest(
      requestId,
      req.user.sub,
      body.rejection_reason,
    );
    return { status: 'rejected' };
  }

  @Get('approval-requests/pending')
  @Permissions('workflows:requests:view')
  async getPendingApprovals(@Request() req: any): Promise<ApprovalRequest[]> {
    return this.approvalWorkflowService.getPendingApprovals(req.user.sub);
  }

  @Get('approval-requests/:requestId/history')
  @Permissions('workflows:requests:view')
  async getApprovalHistory(@Param('requestId') requestId: string) {
    return this.approvalWorkflowService.getApprovalHistory(requestId);
  }

  // ==========================================
  // AUDIT TRAIL ENDPOINTS
  // ==========================================

  @Get('audit-logs')
  @Permissions('admin:audit:view')
  async queryAuditLogs(@Query() query: any) {
    return this.auditTrailService.queryAuditLogs(query);
  }

  @Get('audit-logs/:auditId')
  @Permissions('admin:audit:view')
  async getAuditDetails(@Param('auditId') auditId: string) {
    return this.auditTrailService.getAuditDetails(auditId);
  }

  @Get('audit-logs/entity/:entityType/:entityId/history')
  @Permissions('admin:audit:view')
  async getEntityHistory(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
  ) {
    return this.auditTrailService.getEntityHistory(entityType, entityId);
  }

  @Get('audit-logs/compliance-report')
  @Permissions('compliance:audit:view')
  async getComplianceAuditReport(@Query() query: any) {
    return this.auditTrailService.getComplianceAuditReport(
      query.legal_entity_id,
      query.from_date,
      query.to_date,
    );
  }

  // ==========================================
  // RBAC ENDPOINTS
  // ==========================================

  @Post('roles')
  @Permissions('admin:roles:create')
  async createRole(@Body() body: any, @Request() req: any) {
    const roleId = await this.rbacService.createRole(
      body.role_name,
      body.role_code,
      body.description,
      body.legal_entity_id || null,
      body.parent_role_id || null,
      req.user.sub,
    );
    return { role_id: roleId };
  }

  @Post('roles/:roleId/permissions')
  @Permissions('admin:roles:manage')
  async assignPermissionsToRole(
    @Param('roleId') roleId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    await this.rbacService.assignPermissionsToRole(roleId, body.permissions, req.user.sub);
    return { status: 'success' };
  }

  // ==========================================
  // USER MANAGEMENT (RBAC v1.1 — iam:users:manage)
  // ==========================================

  @Get('users')
  @AnyPermissions('iam:users:manage')
  async listUsers(
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('legal_entity_id') legalEntityId?: string,
  ) {
    return this.userManagementService.listUsers({
      q,
      limit: limit ? parseInt(limit, 10) : 50,
      offset: offset ? parseInt(offset, 10) : 0,
      legal_entity_id: legalEntityId,
    });
  }

  @Get('users/:userId')
  @AnyPermissions('iam:users:manage')
  async getUserDetail(@Param('userId') userId: string) {
    const user = await this.userManagementService.getUser(userId);
    if (!user) throw new (await import('@nestjs/common')).NotFoundException('User not found');
    return user;
  }

  @Get('users/:userId/role-assignments')
  @AnyPermissions('iam:users:manage')
  async getUserRoleAssignments(@Param('userId') userId: string) {
    return this.userManagementService.getRoleAssignments(userId);
  }

  @Post('users/:userId/role-assignments')
  @AnyPermissions('iam:users:manage')
  async assignRole(
    @Param('userId') userId: string,
    @Body() body: { role: string; scope: 'GLOBAL' | 'LEGAL_ENTITY'; legal_entity_id?: string },
  ) {
    await this.userManagementService.assignRole({
      userId,
      role: body.role,
      scope: body.scope,
      legal_entity_id: body.legal_entity_id,
    });
    return { status: 'assigned' };
  }

  @Delete('users/:userId/role-assignments')
  @AnyPermissions('iam:users:manage')
  async removeRole(
    @Param('userId') userId: string,
    @Body() body: { role: string; scope: 'GLOBAL' | 'LEGAL_ENTITY'; legal_entity_id?: string },
    @Request() req: any,
  ) {
    await this.userManagementService.removeRole({
      userId,
      role: body.role,
      scope: body.scope,
      legal_entity_id: body.legal_entity_id,
      actorUserId: req.user.sub,
    });
    return { status: 'removed' };
  }

  @Get('roles/templates')
  @AnyPermissions('iam:users:manage', 'iam:roles:manage')
  async getRoleTemplates() {
    return this.userManagementService.getRoleTemplates();
  }

  @Post('users/:userId/roles')
  @Permissions('admin:users:manage')
  async assignRoleToUser(
    @Param('userId') userId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const assignmentId = await this.rbacService.assignRoleToUser(
      userId,
      body.role_id,
      body.legal_entity_id || null,
      body.department_id || null,
      body.effective_from,
      body.effective_to || null,
      req.user.sub,
    );
    return { assignment_id: assignmentId };
  }

  @Get('users/:userId/permissions')
  @Permissions('admin:users:view')
  async getUserPermissions(@Param('userId') userId: string, @Query('legal_entity_id') legalEntityId?: string) {
    return this.rbacService.getUserPermissions(userId, legalEntityId);
  }

  @Get('users/:userId/roles')
  @Permissions('admin:users:view')
  async getUserRoles(@Param('userId') userId: string) {
    return this.rbacService.getUserRoles(userId);
  }

  @Get('permissions')
  @Permissions('admin:roles:view')
  async getAllPermissions(@Query('category') category?: string) {
    return this.rbacService.getAllPermissions(category);
  }

  @Get('roles/:roleId')
  @Permissions('admin:roles:view')
  async getRoleDetails(@Param('roleId') roleId: string) {
    return this.rbacService.getRoleDetails(roleId);
  }

  @Post('permissions')
  @Permissions('admin:permissions:create')
  async createPermission(@Body() body: any) {
    const permissionId = await this.rbacService.createPermission(
      body.permission_code,
      body.permission_name,
      body.resource_type,
      body.action,
      body.description,
      body.category,
    );
    return { permission_id: permissionId };
  }

  // ==========================================
  // DATA ARCHIVING ENDPOINTS
  // ==========================================

  @Post('retention-policies')
  @Permissions('admin:retention:create')
  async createRetentionPolicy(@Body() body: any, @Request() req: any) {
    const policyId = await this.dataArchivingService.createRetentionPolicy(
      body.policy_name,
      body.entity_type,
      body.retention_period_months,
      body.archive_after_months,
      body.legal_entity_id || null,
      body.auto_archive || true,
      body.auto_delete || false,
      req.user.sub,
    );
    return { policy_id: policyId };
  }

  @Post('archive/policy/:policyId')
  @Permissions('admin:archive:execute')
  async archiveByPolicy(@Param('policyId') policyId: string, @Request() req: any): Promise<ArchiveResult> {
    return this.dataArchivingService.archiveByPolicy(policyId, req.user.sub);
  }

  @Post('archive/record')
  @Permissions('admin:archive:create')
  async archiveRecord(@Body() body: any, @Request() req: any) {
    const archiveId = await this.dataArchivingService.archiveRecord(
      body.batch_id,
      body.entity_type,
      body.entity_id,
      body.record_data,
      body.legal_entity_id || null,
      body.reason,
      req.user.sub,
    );
    return { archive_id: archiveId };
  }

  @Post('archive/:archiveId/restore')
  @Permissions('admin:archive:restore')
  async restoreRecord(@Param('archiveId') archiveId: string) {
    return this.dataArchivingService.restoreRecord(archiveId);
  }

  @Get('archive/records')
  @Permissions('admin:archive:view')
  async getArchivedRecords(@Query() query: any) {
    return this.dataArchivingService.getArchivedRecords(
      query.entity_type,
      query.legal_entity_id,
      query.from_date,
      query.to_date,
      query.limit || 100,
    );
  }

  // ==========================================
  // DELEGATION ENDPOINTS
  // ==========================================

  @Post('delegations')
  @Permissions('users:delegation:create')
  async createDelegation(@Body() body: any, @Request() req: any) {
    const delegationId = await this.delegationService.createDelegation(
      body.delegator_user_id,
      body.delegate_user_id,
      body.delegation_type,
      body.effective_from,
      body.effective_to || null,
      body.legal_entity_id || null,
      body.department_id || null,
      body.permissions || null,
      body.reason,
      body.requires_mfa || false,
      body.max_transaction_amount || null,
      req.user.sub,
    );
    return { delegation_id: delegationId };
  }

  @Get('delegations/active')
  @Permissions('users:delegation:view')
  async getActiveDelegations(@Request() req: any): Promise<Delegation[]> {
    return this.delegationService.getActiveDelegations(req.user.sub);
  }

  @Get('delegations/created')
  @Permissions('users:delegation:view')
  async getDelegationsByDelegator(@Request() req: any) {
    return this.delegationService.getDelegationsByDelegator(req.user.sub);
  }

  @Delete('delegations/:delegationId')
  @Permissions('users:delegation:revoke')
  async revokeDelegation(@Param('delegationId') delegationId: string, @Request() req: any) {
    await this.delegationService.revokeDelegation(delegationId, req.user.sub);
    return { status: 'revoked' };
  }

  @Get('delegations/:delegationId/stats')
  @Permissions('users:delegation:view')
  async getDelegationUsageStats(@Param('delegationId') delegationId: string) {
    return this.delegationService.getDelegationUsageStats(delegationId);
  }

  @Get('delegations/effective-permissions')
  @Permissions('users:delegation:view')
  async getEffectivePermissions(@Request() req: any, @Query('legal_entity_id') legalEntityId?: string) {
    return this.delegationService.getEffectivePermissions(req.user.sub, legalEntityId);
  }

  // ==========================================
  // COST CENTER ENDPOINTS
  // ==========================================

  @Post('cost-centers')
  @Permissions('finance:cost_centers:create')
  async createCostCenter(@Body() body: any, @Request() req: any) {
    // Use provided legal_entity_id or user's first legal entity access
    const legalEntityId = body.legal_entity_id || (req.user.legalEntityAccess && req.user.legalEntityAccess[0]);

    if (!legalEntityId) {
      throw new Error('No legal entity access configured for this user');
    }

    const costCenterId = await this.costCenterService.createCostCenter(
      body.cost_center_code,
      body.cost_center_name,
      legalEntityId,
      body.parent_cost_center_id || null,
      body.department_id || null,
      body.manager_id || null,
      body.cost_type || 'department',
      body.gl_account || null,
      body.description || null,
      req.user.sub,
    );
    return { cost_center_id: costCenterId };
  }

  @Post('cost-centers/:costCenterId/allocations')
  @Permissions('finance:cost_centers:manage')
  async allocateEmployeeToCostCenter(
    @Param('costCenterId') costCenterId: string,
    @Body() body: any,
    @Request() req: any,
  ) {
    const allocationId = await this.costCenterService.allocateEmployeeToCostCenter(
      body.employee_id,
      costCenterId,
      body.allocation_percentage,
      body.effective_from,
      body.effective_to || null,
      body.notes || null,
      req.user.sub,
    );
    return { allocation_id: allocationId };
  }

  @Post('budgets')
  @Permissions('finance:budgets:create')
  async createBudget(@Body() body: any, @Request() req: any) {
    const budgetId = await this.costCenterService.createBudget(
      body.budget_name,
      body.cost_center_id,
      body.fiscal_year,
      body.budget_period || 'annual',
      body.budget_type || 'total_compensation',
      body.budget_amount,
      body.alert_threshold_percentage || 90,
      req.user.sub,
    );
    return { budget_id: budgetId };
  }

  @Get('cost-centers/:costCenterId/budget-utilization')
  @Permissions('finance:budgets:view')
  async calculateBudgetUtilization(
    @Param('costCenterId') costCenterId: string,
    @Query('fiscal_year') fiscalYear: number,
  ) {
    return this.costCenterService.calculateBudgetUtilization(costCenterId, fiscalYear);
  }

  @Get('cost-centers/:costCenterId/report')
  @Permissions('finance:cost_centers:view')
  async getCostCenterReport(
    @Param('costCenterId') costCenterId: string,
    @Query('period') period: string,
  ) {
    return this.costCenterService.getCostCenterReport(costCenterId, period);
  }

  @Get('cost-centers')
  @Permissions('finance:cost_centers:view')
  async getCostCenters(@Query('legal_entity_id') legalEntityId?: string): Promise<CostCenter[]> {
    return this.costCenterService.getCostCenters(legalEntityId);
  }

  @Put('cost-centers/:costCenterId')
  @Permissions('finance:cost_centers:manage')
  async updateCostCenter(
    @Param('costCenterId') costCenterId: string,
    @Body() body: {
      cost_center_code: string;
      cost_center_name: string;
      cost_type?: string;
      gl_account?: string | null;
      description?: string | null;
    },
  ) {
    await this.costCenterService.updateCostCenter(
      costCenterId,
      body.cost_center_code,
      body.cost_center_name,
      body.cost_type || 'department',
      body.gl_account ?? null,
      body.description ?? null,
    );
    return { status: 'updated' };
  }

  @Delete('cost-centers/:costCenterId')
  @Permissions('finance:cost_centers:manage')
  async deleteCostCenter(@Param('costCenterId') costCenterId: string) {
    await this.costCenterService.deleteCostCenter(costCenterId);
    return { status: 'deleted' };
  }

  @Get('budgets/alerts')
  @Permissions('finance:budgets:view')
  async getBudgetAlerts(@Query('legal_entity_id') legalEntityId: string) {
    return this.costCenterService.getBudgetAlerts(legalEntityId);
  }

  // ==========================================
  // ORG UNITS (ORG STRUCTURE) ENDPOINTS
  // ==========================================

  @Get('org-units')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'hr:read')
  async getOrgUnits(@Query('legal_entity_id') legalEntityId?: string) {
    return this.orgUnitService.list(legalEntityId);
  }

  @Post('org-units')
  @Permissions('iam:legal_entities:manage')
  async createOrgUnit(@Body() body: any) {
    const id = await this.orgUnitService.create({
      legal_entity_id: body.legal_entity_id,
      code: body.code,
      name: body.name,
      parent_org_unit_id: body.parent_org_unit_id ?? null,
      sort_order: body.sort_order,
    });
    return { org_unit_id: id };
  }

  @Put('org-units/:orgUnitId')
  @Permissions('iam:legal_entities:manage')
  async updateOrgUnit(
    @Param('orgUnitId') orgUnitId: string,
    @Body() body: { code?: string; name?: string; parent_org_unit_id?: string | null; sort_order?: number; is_active?: boolean },
  ) {
    await this.orgUnitService.update(orgUnitId, body);
    return { status: 'updated' };
  }

  @Delete('org-units/:orgUnitId')
  @Permissions('iam:legal_entities:manage')
  async deleteOrgUnit(@Param('orgUnitId') orgUnitId: string) {
    await this.orgUnitService.delete(orgUnitId);
    return { status: 'deleted' };
  }

  @Get('org-units/:orgUnitId/path')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'hr:read')
  async getOrgUnitPath(@Param('orgUnitId') orgUnitId: string) {
    const path = await this.orgUnitService.getPath(orgUnitId);
    return { path };
  }

  // ==========================================
  // EMPLOYMENT ASSIGNMENTS
  // ==========================================

  @Get('employment-assignments/list')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'employment:read')
  async listEmploymentAssignments(@Query('legal_entity_id') legalEntityId: string) {
    if (!legalEntityId) {
      return [];
    }
    return this.employmentAssignmentService.listByLegalEntity(legalEntityId);
  }

  @Get('employments/:employmentId/assignments')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'employment:read')
  async getEmploymentAssignments(@Param('employmentId') employmentId: string) {
    return this.employmentAssignmentService.listForEmployment(employmentId);
  }

  @Post('employment-assignments')
  @AnyPermissions('iam:legal_entities:manage', 'employment:write')
  async createEmploymentAssignment(@Body() body: any) {
    const id = await this.employmentAssignmentService.create({
      employment_id: body.employment_id,
      org_unit_id: body.org_unit_id,
      cost_center_id: body.cost_center_id ?? null,
      position_id: body.position_id ?? null,
      effective_from: body.effective_from,
      effective_to: body.effective_to ?? null,
    });
    return { assignment_id: id };
  }

  @Patch('employment-assignments/:id')
  @AnyPermissions('iam:legal_entities:manage', 'employment:write')
  async updateEmploymentAssignment(@Param('id') id: string, @Body() body: any) {
    await this.employmentAssignmentService.update(id, {
      org_unit_id: body.org_unit_id,
      cost_center_id: body.cost_center_id,
      position_id: body.position_id,
      effective_from: body.effective_from,
      effective_to: body.effective_to,
    });
    return { assignment_id: id };
  }

  // ==========================================
  // POSITIONS
  // ==========================================

  @Get('positions')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'hr:read')
  async listPositions(
    @Query('legal_entity_id') legalEntityId?: string,
    @Query('org_unit_id') orgUnitId?: string,
    @Query('status') status?: string,
  ) {
    return this.positionService.list({ legal_entity_id: legalEntityId, org_unit_id: orgUnitId, status });
  }

  @Get('positions/:id')
  @AnyPermissions('iam:legal_entities:manage', 'legal_entity:read', 'hr:read')
  async getPosition(@Param('id') id: string) {
    return this.positionService.getById(id);
  }

  @Post('positions')
  @AnyPermissions('iam:legal_entities:manage')
  async createPosition(@Body() body: any) {
    const id = await this.positionService.create({
      legal_entity_id: body.legal_entity_id,
      org_unit_id: body.org_unit_id,
      position_code: body.position_code,
      title: body.title,
      default_cost_center_id: body.default_cost_center_id ?? null,
    });
    return { position_id: id };
  }

  @Put('positions/:id')
  @AnyPermissions('iam:legal_entities:manage')
  async updatePosition(@Param('id') id: string, @Body() body: any) {
    await this.positionService.update(id, {
      title: body.title,
      default_cost_center_id: body.default_cost_center_id,
    });
    return { status: 'updated' };
  }

  @Post('positions/:id/freeze')
  @AnyPermissions('iam:legal_entities:manage')
  async freezePosition(@Param('id') id: string) {
    return this.positionService.setStatus(id, 'FROZEN');
  }

  @Post('positions/:id/close')
  @AnyPermissions('iam:legal_entities:manage')
  async closePosition(@Param('id') id: string) {
    return this.positionService.setStatus(id, 'CLOSED');
  }

  @Delete('positions/:id')
  @AnyPermissions('iam:legal_entities:manage')
  async deletePosition(@Param('id') id: string) {
    return this.positionService.delete(id);
  }

  // ==========================================
  // BULK OPERATIONS ENDPOINTS
  // ==========================================

  @Post('bulk/employees/import')
  @Permissions('employees:bulk:import')
  async bulkImportEmployees(@Body() body: any, @Request() req: any): Promise<BatchJobResult> {
    return this.bulkOperationsService.bulkImportEmployees(
      body.csv_data,
      body.legal_entity_id,
      req.user.sub,
    );
  }

  @Post('bulk/salaries/update')
  @Permissions('employees:bulk:update')
  async bulkUpdateSalaries(@Body() body: any, @Request() req: any): Promise<BatchJobResult> {
    return this.bulkOperationsService.bulkUpdateSalaries(
      body.updates,
      body.legal_entity_id,
      req.user.sub,
    );
  }

  @Post('bulk/employees/terminate')
  @Permissions('employees:bulk:terminate')
  async bulkTerminateEmployees(@Body() body: any, @Request() req: any): Promise<BatchJobResult> {
    return this.bulkOperationsService.bulkTerminateEmployees(
      body.terminations,
      body.legal_entity_id,
      req.user.sub,
    );
  }

  @Get('bulk/jobs/:jobId')
  @Permissions('bulk:jobs:view')
  async getBatchJobStatus(@Param('jobId') jobId: string) {
    return this.bulkOperationsService.getBatchJobStatus(jobId);
  }

  @Get('bulk/jobs/:jobId/items')
  @Permissions('bulk:jobs:view')
  async getBatchJobItems(
    @Param('jobId') jobId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.bulkOperationsService.getBatchJobItems(
      jobId,
      limit || 100,
      offset || 0,
    );
  }
}
