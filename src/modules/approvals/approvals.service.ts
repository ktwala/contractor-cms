import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import {
  CreateWorkflowDto,
  UpdateWorkflowDto,
  SubmitForApprovalDto,
  ApproveStepDto,
  RejectStepDto,
  DelegateStepDto,
  CreateDelegationDto,
  ApprovalEntityType,
  ApprovalStepStatus,
  WorkflowResponseDto,
  ApprovalInstanceResponseDto,
  PendingApprovalResponseDto,
} from './dto/approval.dto';

@Injectable()
export class ApprovalsService {
  private readonly logger = new Logger(ApprovalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ============================================================================
  // Workflow Management
  // ============================================================================

  async createWorkflow(
    dto: CreateWorkflowDto,
    userId: string,
  ): Promise<WorkflowResponseDto> {
    // Validate levels are sequential
    const sortedLevels = [...dto.levels].sort((a, b) => a.level_order - b.level_order);
    for (let i = 0; i < sortedLevels.length; i++) {
      if (sortedLevels[i].level_order !== i + 1) {
        throw new BadRequestException({
          code: 'INVALID_LEVEL_ORDER',
          message: 'Level orders must be sequential starting from 1',
        });
      }
    }

    // Validate each level has either user or role
    for (const level of dto.levels) {
      if (!level.approver_user_id && !level.approver_role_id) {
        throw new BadRequestException({
          code: 'MISSING_APPROVER',
          message: `Level ${level.level_order} must have either approver_user_id or approver_role_id`,
        });
      }
    }

    const workflow = await this.prisma.approvalWorkflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        entityType: dto.entity_type,
        legalEntityId: dto.legal_entity_id,
        payGroupId: dto.pay_group_id,
        levels: {
          create: dto.levels.map((level) => ({
            levelOrder: level.level_order,
            name: level.name,
            description: level.description,
            approverUserId: level.approver_user_id,
            approverRoleId: level.approver_role_id,
            canDelegate: level.can_delegate ?? true,
            autoApproveAfterHours: level.auto_approve_after_hours,
          })),
        },
      },
      include: {
        levels: { orderBy: { levelOrder: 'asc' } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'ApprovalWorkflow',
      entityId: workflow.id,
      newValue: workflow as any,
    });

    return this.mapWorkflowToResponse(workflow);
  }

  async updateWorkflow(
    workflowId: string,
    dto: UpdateWorkflowDto,
    userId: string,
  ): Promise<WorkflowResponseDto> {
    const existing = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Workflow ${workflowId} not found`,
      });
    }

    const workflow = await this.prisma.approvalWorkflow.update({
      where: { id: workflowId },
      data: {
        name: dto.name,
        description: dto.description,
        isActive: dto.is_active,
      },
      include: {
        levels: { orderBy: { levelOrder: 'asc' } },
      },
    });

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'ApprovalWorkflow',
      entityId: workflowId,
      oldValue: existing as any,
      newValue: workflow as any,
    });

    return this.mapWorkflowToResponse(workflow);
  }

  async getWorkflow(workflowId: string): Promise<WorkflowResponseDto> {
    const workflow = await this.prisma.approvalWorkflow.findUnique({
      where: { id: workflowId },
      include: {
        levels: { orderBy: { levelOrder: 'asc' } },
      },
    });

    if (!workflow) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Workflow ${workflowId} not found`,
      });
    }

    return this.mapWorkflowToResponse(workflow);
  }

  async listWorkflows(entityType?: ApprovalEntityType): Promise<WorkflowResponseDto[]> {
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: entityType ? { entityType, isActive: true } : { isActive: true },
      include: {
        levels: { orderBy: { levelOrder: 'asc' } },
      },
      orderBy: { name: 'asc' },
    });

    return workflows.map((w) => this.mapWorkflowToResponse(w));
  }

  // ============================================================================
  // Approval Instance Management
  // ============================================================================

  async submitForApproval(
    dto: SubmitForApprovalDto,
    userId: string,
  ): Promise<ApprovalInstanceResponseDto> {
    // Check if already submitted
    const existing = await this.prisma.approvalInstance.findUnique({
      where: {
        entityType_entityId: {
          entityType: dto.entity_type,
          entityId: dto.entity_id,
        },
      },
    });

    if (existing && !existing.isCancelled) {
      throw new ConflictException({
        code: 'ALREADY_SUBMITTED',
        message: 'This entity has already been submitted for approval',
      });
    }

    // Find applicable workflow
    const workflow = await this.findWorkflowForEntity(dto.entity_type, dto.entity_id);

    if (!workflow) {
      throw new NotFoundException({
        code: 'NO_WORKFLOW',
        message: `No active approval workflow found for ${dto.entity_type}`,
      });
    }

    // Create instance and first step
    const instance = await this.prisma.$transaction(async (tx) => {
      const newInstance = await tx.approvalInstance.create({
        data: {
          workflowId: workflow.id,
          entityType: dto.entity_type,
          entityId: dto.entity_id,
          submittedBy: userId,
          currentLevel: 1,
        },
      });

      // Get first level
      const firstLevel = workflow.levels.find((l: any) => l.levelOrder === 1);
      if (!firstLevel) {
        throw new BadRequestException({
          code: 'NO_LEVELS',
          message: 'Workflow has no approval levels',
        });
      }

      // Determine assignee (check for delegation)
      const assignee = await this.getAssigneeForLevel(firstLevel);

      await tx.approvalStep.create({
        data: {
          instanceId: newInstance.id,
          levelId: firstLevel.id,
          levelOrder: 1,
          assignedTo: assignee,
          status: 'PENDING',
        },
      });

      return newInstance;
    });

    await this.auditService.log({
      userId,
      action: 'SUBMIT_FOR_APPROVAL',
      entityType: dto.entity_type,
      entityId: dto.entity_id,
      newValue: { instance_id: instance.id, workflow_id: workflow.id },
    });

    return this.getApprovalInstance(instance.id);
  }

  async approveStep(
    stepId: string,
    dto: ApproveStepDto,
    userId: string,
  ): Promise<ApprovalInstanceResponseDto> {
    const step = await this.prisma.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        instance: {
          include: {
            workflow: {
              include: { levels: { orderBy: { levelOrder: 'asc' } } },
            },
          },
        },
        level: true,
      },
    });

    if (!step) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Approval step ${stepId} not found`,
      });
    }

    // Validate user can approve
    await this.validateCanAct(step, userId);

    if (step.status !== 'PENDING') {
      throw new ConflictException({
        code: 'INVALID_STATUS',
        message: `Step is already ${step.status}`,
      });
    }

    const instance = step.instance;
    const workflow = instance.workflow;
    const totalLevels = workflow.levels.length;
    const isLastLevel = step.levelOrder === totalLevels;

    await this.prisma.$transaction(async (tx) => {
      // Update step
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: 'APPROVED',
          actedBy: userId,
          actedAt: new Date(),
          comment: dto.comment,
        },
      });

      if (isLastLevel) {
        // Complete the instance
        await tx.approvalInstance.update({
          where: { id: instance.id },
          data: {
            isComplete: true,
            completedAt: new Date(),
          },
        });

        // Update entity status (e.g., PayRun to APPROVED)
        await this.updateEntityStatus(tx, instance.entityType, instance.entityId, 'APPROVED');
      } else {
        // Create next step
        const nextLevel = workflow.levels.find((l: any) => l.levelOrder === step.levelOrder + 1);
        if (nextLevel) {
          const nextAssignee = await this.getAssigneeForLevel(nextLevel);

          await tx.approvalStep.create({
            data: {
              instanceId: instance.id,
              levelId: nextLevel.id,
              levelOrder: nextLevel.levelOrder,
              assignedTo: nextAssignee,
              status: 'PENDING',
            },
          });

          await tx.approvalInstance.update({
            where: { id: instance.id },
            data: { currentLevel: nextLevel.levelOrder },
          });
        }
      }
    });

    await this.auditService.log({
      userId,
      action: 'APPROVE_STEP',
      entityType: instance.entityType,
      entityId: instance.entityId,
      newValue: {
        step_id: stepId,
        level: step.levelOrder,
        comment: dto.comment,
        is_final: isLastLevel,
      },
    });

    return this.getApprovalInstance(instance.id);
  }

  async rejectStep(
    stepId: string,
    dto: RejectStepDto,
    userId: string,
  ): Promise<ApprovalInstanceResponseDto> {
    const step = await this.prisma.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        instance: true,
        level: true,
      },
    });

    if (!step) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Approval step ${stepId} not found`,
      });
    }

    await this.validateCanAct(step, userId);

    if (step.status !== 'PENDING') {
      throw new ConflictException({
        code: 'INVALID_STATUS',
        message: `Step is already ${step.status}`,
      });
    }

    await this.prisma.$transaction(async (tx) => {
      // Update step
      await tx.approvalStep.update({
        where: { id: stepId },
        data: {
          status: 'REJECTED',
          actedBy: userId,
          actedAt: new Date(),
          comment: dto.comment,
        },
      });

      // Cancel the instance
      await tx.approvalInstance.update({
        where: { id: step.instance.id },
        data: {
          isCancelled: true,
          completedAt: new Date(),
        },
      });

      // Update entity status back (e.g., PayRun to CALCULATED)
      await this.updateEntityStatus(
        tx,
        step.instance.entityType,
        step.instance.entityId,
        'REJECTED',
      );
    });

    await this.auditService.log({
      userId,
      action: 'REJECT_STEP',
      entityType: step.instance.entityType,
      entityId: step.instance.entityId,
      newValue: {
        step_id: stepId,
        level: step.levelOrder,
        comment: dto.comment,
      },
    });

    return this.getApprovalInstance(step.instance.id);
  }

  async delegateStep(
    stepId: string,
    dto: DelegateStepDto,
    userId: string,
  ): Promise<ApprovalInstanceResponseDto> {
    const step = await this.prisma.approvalStep.findUnique({
      where: { id: stepId },
      include: {
        instance: true,
        level: true,
      },
    });

    if (!step) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Approval step ${stepId} not found`,
      });
    }

    // Only assigned user can delegate
    if (step.assignedTo !== userId) {
      throw new ForbiddenException({
        code: 'NOT_ASSIGNED',
        message: 'Only the assigned approver can delegate',
      });
    }

    if (!step.level.canDelegate) {
      throw new ForbiddenException({
        code: 'DELEGATION_NOT_ALLOWED',
        message: 'This approval level does not allow delegation',
      });
    }

    if (step.status !== 'PENDING') {
      throw new ConflictException({
        code: 'INVALID_STATUS',
        message: `Step is already ${step.status}`,
      });
    }

    await this.prisma.approvalStep.update({
      where: { id: stepId },
      data: {
        delegatedTo: dto.delegate_to,
        delegatedAt: new Date(),
        delegationNote: dto.note,
        status: 'DELEGATED',
      },
    });

    // Create new step for delegate
    await this.prisma.approvalStep.create({
      data: {
        instanceId: step.instanceId,
        levelId: step.levelId,
        levelOrder: step.levelOrder,
        assignedTo: dto.delegate_to,
        status: 'PENDING',
      },
    });

    await this.auditService.log({
      userId,
      action: 'DELEGATE_STEP',
      entityType: step.instance.entityType,
      entityId: step.instance.entityId,
      newValue: {
        step_id: stepId,
        delegated_to: dto.delegate_to,
        note: dto.note,
      },
    });

    return this.getApprovalInstance(step.instance.id);
  }

  // ============================================================================
  // Query Methods
  // ============================================================================

  async getApprovalInstance(instanceId: string): Promise<ApprovalInstanceResponseDto> {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: { id: instanceId },
      include: {
        workflow: {
          include: { levels: { orderBy: { levelOrder: 'asc' } } },
        },
        submitter: { select: { id: true, firstName: true, lastName: true } },
        steps: {
          include: {
            level: true,
            assignedUser: { select: { id: true, firstName: true, lastName: true } },
            delegatedUser: { select: { id: true, firstName: true, lastName: true } },
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!instance) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Approval instance ${instanceId} not found`,
      });
    }

    return this.mapInstanceToResponse(instance);
  }

  async getApprovalForEntity(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<ApprovalInstanceResponseDto | null> {
    const instance = await this.prisma.approvalInstance.findUnique({
      where: {
        entityType_entityId: {
          entityType,
          entityId,
        },
      },
      include: {
        workflow: {
          include: { levels: { orderBy: { levelOrder: 'asc' } } },
        },
        submitter: { select: { id: true, firstName: true, lastName: true } },
        steps: {
          include: {
            level: true,
            assignedUser: { select: { id: true, firstName: true, lastName: true } },
            delegatedUser: { select: { id: true, firstName: true, lastName: true } },
            actor: { select: { id: true, firstName: true, lastName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!instance) {
      return null;
    }

    return this.mapInstanceToResponse(instance);
  }

  async getPendingApprovals(userId: string): Promise<PendingApprovalResponseDto[]> {
    // Get direct assignments
    const directSteps = await this.prisma.approvalStep.findMany({
      where: {
        assignedTo: userId,
        status: 'PENDING',
        instance: { isCancelled: false },
      },
      include: {
        instance: {
          include: { submitter: { select: { firstName: true, lastName: true } } },
        },
        level: true,
      },
    });

    // Get delegated assignments (via ApprovalDelegation)
    const today = new Date();
    const activeDelegations = await this.prisma.approvalDelegation.findMany({
      where: {
        delegateId: userId,
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    const delegatorIds = activeDelegations.map((d) => d.delegatorId);

    const delegatedSteps =
      delegatorIds.length > 0
        ? await this.prisma.approvalStep.findMany({
            where: {
              assignedTo: { in: delegatorIds },
              status: 'PENDING',
              instance: { isCancelled: false },
            },
            include: {
              instance: {
                include: { submitter: { select: { firstName: true, lastName: true } } },
              },
              level: true,
            },
          })
        : [];

    const allSteps = [...directSteps, ...delegatedSteps];

    return allSteps.map((step) => ({
      step_id: step.id,
      instance_id: step.instanceId,
      entity_type: step.instance.entityType as ApprovalEntityType,
      entity_id: step.instance.entityId,
      level_name: step.level.name,
      level_order: step.levelOrder,
      submitted_by: `${step.instance.submitter.firstName} ${step.instance.submitter.lastName}`,
      submitted_at: step.instance.submittedAt.toISOString(),
      can_delegate: step.level.canDelegate,
      is_delegated: step.assignedTo !== userId,
    }));
  }

  // ============================================================================
  // Delegation Management
  // ============================================================================

  async createDelegation(
    dto: CreateDelegationDto,
    userId: string,
  ): Promise<{ id: string; message: string }> {
    const delegation = await this.prisma.approvalDelegation.create({
      data: {
        delegatorId: userId,
        delegateId: dto.delegate_id,
        startDate: new Date(dto.start_date),
        endDate: new Date(dto.end_date),
        reason: dto.reason,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE_DELEGATION',
      entityType: 'ApprovalDelegation',
      entityId: delegation.id,
      newValue: {
        delegate_id: dto.delegate_id,
        start_date: dto.start_date,
        end_date: dto.end_date,
      },
    });

    return {
      id: delegation.id,
      message: `Delegation created from ${dto.start_date} to ${dto.end_date}`,
    };
  }

  async cancelDelegation(delegationId: string, userId: string): Promise<void> {
    const delegation = await this.prisma.approvalDelegation.findUnique({
      where: { id: delegationId },
    });

    if (!delegation) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Delegation ${delegationId} not found`,
      });
    }

    if (delegation.delegatorId !== userId) {
      throw new ForbiddenException({
        code: 'NOT_OWNER',
        message: 'Only the delegator can cancel this delegation',
      });
    }

    await this.prisma.approvalDelegation.update({
      where: { id: delegationId },
      data: { isActive: false },
    });

    await this.auditService.log({
      userId,
      action: 'CANCEL_DELEGATION',
      entityType: 'ApprovalDelegation',
      entityId: delegationId,
    });
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private async findWorkflowForEntity(
    entityType: ApprovalEntityType,
    entityId: string,
  ): Promise<any> {
    // Get entity details for matching (e.g., PayRun's legal entity and pay group)
    let legalEntityId: string | null = null;
    let payGroupId: string | null = null;

    if (entityType === 'PAYRUN') {
      const payrun = await this.prisma.payRun.findUnique({
        where: { id: entityId },
        include: { payGroup: true },
      });
      if (payrun) {
        legalEntityId = payrun.payGroup.legalEntityId;
        payGroupId = payrun.payGroupId;
      }
    }

    // Find most specific matching workflow
    // Priority: payGroup specific > legalEntity specific > global
    const workflows = await this.prisma.approvalWorkflow.findMany({
      where: {
        entityType,
        isActive: true,
      },
      include: {
        levels: { orderBy: { levelOrder: 'asc' } },
      },
    });

    // Find best match
    let bestMatch = null;
    let bestScore = -1;

    for (const workflow of workflows) {
      let score = 0;

      // Pay group match
      if (workflow.payGroupId === payGroupId) {
        score += 2;
      } else if (workflow.payGroupId !== null) {
        continue; // Different pay group, skip
      }

      // Legal entity match
      if (workflow.legalEntityId === legalEntityId) {
        score += 1;
      } else if (workflow.legalEntityId !== null) {
        continue; // Different legal entity, skip
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = workflow;
      }
    }

    return bestMatch;
  }

  private async getAssigneeForLevel(level: any): Promise<string> {
    // If specific user, return that user
    if (level.approverUserId) {
      // Check for active delegation
      const today = new Date();
      const delegation = await this.prisma.approvalDelegation.findFirst({
        where: {
          delegatorId: level.approverUserId,
          isActive: true,
          startDate: { lte: today },
          endDate: { gte: today },
        },
      });

      return delegation ? delegation.delegateId : level.approverUserId;
    }

    // If role-based, find a user with that role (RBAC v1.1: RoleAssignment)
    if (level.approverRoleId) {
      const assignment = await this.prisma.roleAssignment.findFirst({
        where: { roleId: level.approverRoleId },
        include: { user: true },
      });

      if (assignment) {
        return assignment.userId;
      }
    }

    throw new BadRequestException({
      code: 'NO_APPROVER',
      message: `No approver found for level ${level.name}`,
    });
  }

  private async validateCanAct(step: any, userId: string): Promise<void> {
    // Direct assignment
    if (step.assignedTo === userId) {
      return;
    }

    // Check if user is a delegate
    const today = new Date();
    const delegation = await this.prisma.approvalDelegation.findFirst({
      where: {
        delegatorId: step.assignedTo,
        delegateId: userId,
        isActive: true,
        startDate: { lte: today },
        endDate: { gte: today },
      },
    });

    if (delegation) {
      return;
    }

    throw new ForbiddenException({
      code: 'NOT_AUTHORIZED',
      message: 'You are not authorized to act on this approval step',
    });
  }

  private async updateEntityStatus(
    tx: any,
    entityType: string,
    entityId: string,
    action: 'APPROVED' | 'REJECTED',
  ): Promise<void> {
    if (entityType === 'PAYRUN') {
      const newStatus = action === 'APPROVED' ? 'APPROVED' : 'CALCULATED';
      await tx.payRun.update({
        where: { id: entityId },
        data: {
          status: newStatus,
          ...(action === 'APPROVED'
            ? {
                approvedAt: new Date(),
                lockedAt: new Date(),
              }
            : {}),
        },
      });
    }
    // Add other entity types as needed
  }

  private mapWorkflowToResponse(workflow: any): WorkflowResponseDto {
    return {
      id: workflow.id,
      name: workflow.name,
      description: workflow.description,
      entity_type: workflow.entityType as ApprovalEntityType,
      legal_entity_id: workflow.legalEntityId,
      pay_group_id: workflow.payGroupId,
      is_active: workflow.isActive,
      levels: workflow.levels.map((l: any) => ({
        id: l.id,
        level_order: l.levelOrder,
        name: l.name,
        description: l.description,
        approver_user_id: l.approverUserId,
        approver_role_id: l.approverRoleId,
        can_delegate: l.canDelegate,
        auto_approve_after_hours: l.autoApproveAfterHours,
      })),
      created_at: workflow.createdAt.toISOString(),
    };
  }

  private mapInstanceToResponse(instance: any): ApprovalInstanceResponseDto {
    return {
      id: instance.id,
      workflow_id: instance.workflowId,
      workflow_name: instance.workflow.name,
      entity_type: instance.entityType as ApprovalEntityType,
      entity_id: instance.entityId,
      current_level: instance.currentLevel,
      total_levels: instance.workflow.levels.length,
      is_complete: instance.isComplete,
      is_cancelled: instance.isCancelled,
      submitted_by: instance.submittedBy,
      submitted_by_name: instance.submitter
        ? `${instance.submitter.firstName} ${instance.submitter.lastName}`
        : undefined,
      submitted_at: instance.submittedAt.toISOString(),
      completed_at: instance.completedAt?.toISOString(),
      steps: instance.steps.map((s: any) => ({
        id: s.id,
        level_order: s.levelOrder,
        level_name: s.level.name,
        status: s.status as ApprovalStepStatus,
        assigned_to: s.assignedTo,
        assigned_to_name: s.assignedUser
          ? `${s.assignedUser.firstName} ${s.assignedUser.lastName}`
          : undefined,
        delegated_to: s.delegatedTo,
        delegated_to_name: s.delegatedUser
          ? `${s.delegatedUser.firstName} ${s.delegatedUser.lastName}`
          : undefined,
        acted_by: s.actedBy,
        acted_by_name: s.actor ? `${s.actor.firstName} ${s.actor.lastName}` : undefined,
        acted_at: s.actedAt?.toISOString(),
        comment: s.comment,
        created_at: s.createdAt.toISOString(),
      })),
    };
  }
}
