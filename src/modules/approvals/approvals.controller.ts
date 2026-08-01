import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApprovalsService } from './approvals.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  SubmitForApprovalDto,
  ApproveStepDto,
  RejectStepDto,
  DelegateStepDto,
  CreateDelegationDto,
  ApprovalEntityType,
  WorkflowResponseDto,
  ApprovalInstanceResponseDto,
  PendingApprovalResponseDto,
} from './dto/approval.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';

@ApiTags('Approvals')
@ApiBearerAuth('bearerAuth')
@Controller('approvals')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  // ============================================================================
  // Workflow Management
  // ============================================================================

  @Post('workflows')
  @Permissions('approval:admin')
  @ApiOperation({ summary: 'Create an approval workflow' })
  @ApiResponse({ status: 201, description: 'Created', type: WorkflowResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  async createWorkflow(
    @Body() dto: CreateWorkflowDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<WorkflowResponseDto> {
    return this.approvalsService.createWorkflow(dto, user.sub);
  }

  @Get('workflows')
  @Permissions('approval:read')
  @ApiOperation({ summary: 'List approval workflows' })
  @ApiQuery({ name: 'entity_type', enum: ApprovalEntityType, required: false })
  @ApiResponse({ status: 200, description: 'OK', type: [WorkflowResponseDto] })
  async listWorkflows(
    @Query('entity_type') entityType?: ApprovalEntityType,
  ): Promise<WorkflowResponseDto[]> {
    return this.approvalsService.listWorkflows(entityType);
  }

  @Get('workflows/:id')
  @Permissions('approval:read')
  @ApiOperation({ summary: 'Get an approval workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'OK', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getWorkflow(@Param('id') id: string): Promise<WorkflowResponseDto> {
    return this.approvalsService.getWorkflow(id);
  }

  @Patch('workflows/:id')
  @Permissions('approval:admin')
  @ApiOperation({ summary: 'Update an approval workflow' })
  @ApiParam({ name: 'id', description: 'Workflow ID' })
  @ApiResponse({ status: 200, description: 'Updated', type: WorkflowResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async updateWorkflow(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<WorkflowResponseDto> {
    return this.approvalsService.updateWorkflow(id, dto, user.sub);
  }

  // ============================================================================
  // Approval Actions
  // ============================================================================

  @Post('submit')
  @Permissions('approval:submit')
  @ApiOperation({ summary: 'Submit an entity for approval' })
  @ApiResponse({ status: 201, description: 'Submitted', type: ApprovalInstanceResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 404, description: 'No workflow found' })
  @ApiResponse({ status: 409, description: 'Already submitted' })
  async submitForApproval(
    @Body() dto: SubmitForApprovalDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApprovalInstanceResponseDto> {
    return this.approvalsService.submitForApproval(dto, user.sub);
  }

  @Post('steps/:stepId/approve')
  @Permissions('approval:approve')
  @ApiOperation({ summary: 'Approve an approval step' })
  @ApiParam({ name: 'stepId', description: 'Approval step ID' })
  @ApiResponse({ status: 200, description: 'Approved', type: ApprovalInstanceResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to approve' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  @ApiResponse({ status: 409, description: 'Step already processed' })
  async approveStep(
    @Param('stepId') stepId: string,
    @Body() dto: ApproveStepDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApprovalInstanceResponseDto> {
    return this.approvalsService.approveStep(stepId, dto, user.sub);
  }

  @Post('steps/:stepId/reject')
  @Permissions('approval:approve')
  @ApiOperation({ summary: 'Reject an approval step' })
  @ApiParam({ name: 'stepId', description: 'Approval step ID' })
  @ApiResponse({ status: 200, description: 'Rejected', type: ApprovalInstanceResponseDto })
  @ApiResponse({ status: 403, description: 'Not authorized to reject' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  @ApiResponse({ status: 409, description: 'Step already processed' })
  async rejectStep(
    @Param('stepId') stepId: string,
    @Body() dto: RejectStepDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApprovalInstanceResponseDto> {
    return this.approvalsService.rejectStep(stepId, dto, user.sub);
  }

  @Post('steps/:stepId/delegate')
  @Permissions('approval:approve')
  @ApiOperation({ summary: 'Delegate an approval step to another user' })
  @ApiParam({ name: 'stepId', description: 'Approval step ID' })
  @ApiResponse({ status: 200, description: 'Delegated', type: ApprovalInstanceResponseDto })
  @ApiResponse({ status: 403, description: 'Delegation not allowed' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  async delegateStep(
    @Param('stepId') stepId: string,
    @Body() dto: DelegateStepDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApprovalInstanceResponseDto> {
    return this.approvalsService.delegateStep(stepId, dto, user.sub);
  }

  // ============================================================================
  // Query Endpoints
  // ============================================================================

  @Get('pending')
  @Permissions('approval:approve')
  @ApiOperation({ summary: 'Get pending approvals for current user' })
  @ApiResponse({ status: 200, description: 'OK', type: [PendingApprovalResponseDto] })
  async getPendingApprovals(
    @CurrentUser() user: CurrentUserData,
  ): Promise<PendingApprovalResponseDto[]> {
    return this.approvalsService.getPendingApprovals(user.sub);
  }

  @Get('instances/:id')
  @Permissions('approval:read')
  @ApiOperation({ summary: 'Get an approval instance by ID' })
  @ApiParam({ name: 'id', description: 'Instance ID' })
  @ApiResponse({ status: 200, description: 'OK', type: ApprovalInstanceResponseDto })
  @ApiResponse({ status: 404, description: 'Not found' })
  async getApprovalInstance(@Param('id') id: string): Promise<ApprovalInstanceResponseDto> {
    return this.approvalsService.getApprovalInstance(id);
  }

  @Get('entity/:entityType/:entityId')
  @Permissions('approval:read')
  @ApiOperation({ summary: 'Get approval status for an entity' })
  @ApiParam({ name: 'entityType', enum: ApprovalEntityType })
  @ApiParam({ name: 'entityId', description: 'Entity ID (e.g., PayRun ID)' })
  @ApiResponse({ status: 200, description: 'OK', type: ApprovalInstanceResponseDto })
  async getApprovalForEntity(
    @Param('entityType') entityType: ApprovalEntityType,
    @Param('entityId') entityId: string,
  ): Promise<ApprovalInstanceResponseDto | null> {
    return this.approvalsService.getApprovalForEntity(entityType, entityId);
  }

  // ============================================================================
  // Delegation Management
  // ============================================================================

  @Post('delegations')
  @Permissions('approval:approve')
  @ApiOperation({ summary: 'Create an approval delegation (for when you are away)' })
  @ApiResponse({ status: 201, description: 'Created' })
  async createDelegation(
    @Body() dto: CreateDelegationDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ id: string; message: string }> {
    return this.approvalsService.createDelegation(dto, user.sub);
  }

  @Delete('delegations/:id')
  @Permissions('approval:approve')
  @ApiOperation({ summary: 'Cancel an approval delegation' })
  @ApiParam({ name: 'id', description: 'Delegation ID' })
  @ApiResponse({ status: 200, description: 'Cancelled' })
  @ApiResponse({ status: 403, description: 'Not the delegator' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async cancelDelegation(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
  ): Promise<void> {
    return this.approvalsService.cancelDelegation(id, user.sub);
  }
}
