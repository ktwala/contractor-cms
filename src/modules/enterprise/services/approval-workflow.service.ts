import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../core/database/prisma.service';

interface WorkflowStep {
  step_order: number;
  step_name: string;
  approver_type: 'user' | 'role' | 'manager' | 'department_head' | 'custom';
  approver_user_id?: string;
  approver_role_id?: string;
  is_parallel?: boolean;
  require_all_approvers?: boolean;
}

export interface ApprovalRequest {
  id: string;
  workflow_id: string;
  request_type: string;
  entity_type: string;
  entity_id: string;
  current_step: number;
  status: string;
  due_date: Date;
}

@Injectable()
export class ApprovalWorkflowService {
  constructor(private readonly prisma: PrismaService) { }

  /**
   * Create an approval workflow
   */
  async createWorkflow(
    workflowName: string,
    workflowType: string,
    legalEntityId: string | null,
    steps: WorkflowStep[],
    userId: string,
    config?: any,
  ): Promise<string> {
    const workflow = await (this.prisma as any).approvalWorkflow.create({
      data: {
        workflowName,
        workflowType,
        legalEntityId,
        isActive: true,
        config: config || {},
        createdBy: userId,
      },
    });

    // Create workflow steps
    for (const step of steps) {
      await (this.prisma as any).approvalWorkflowStep.create({
        data: {
          workflowId: workflow.id,
          stepOrder: step.step_order,
          stepName: step.step_name,
          approverType: step.approver_type,
          approverUserId: step.approver_user_id || null,
          approverRoleId: step.approver_role_id || null,
          isParallel: step.is_parallel || false,
          requireAllApprovers: step.require_all_approvers || false,
        },
      });
    }

    return workflow.id;
  }

  /**
   * Submit a request for approval
   */
  async submitApprovalRequest(
    workflowId: string,
    requestType: string,
    entityType: string,
    entityId: string,
    legalEntityId: string,
    requestData: any,
    totalAmount: number | null,
    reason: string,
    userId: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
  ): Promise<string> {
    // Get workflow details
    const workflow = await (this.prisma as any).approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new Error('Workflow not found');
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + (workflow.maxApprovalDays || 7));

    const request = await (this.prisma as any).approvalRequest.create({
      data: {
        workflowId,
        requestType,
        entityType,
        entityId,
        legalEntityId,
        requestedBy: userId,
        currentStep: 1,
        status: 'pending',
        priority,
        requestData,
        totalAmount,
        reason,
        dueDate,
      },
    });

    // Check if auto-approval applies
    await this.checkAutoApproval(request.id, workflowId, totalAmount);

    // Notify approvers for step 1
    await this.notifyApprovers(request.id, 1);

    return request.id;
  }

  /**
   * Approve a request
   */
  async approveRequest(
    requestId: string,
    approverId: string,
    comments: string | null = null,
  ): Promise<{ status: string; completed: boolean }> {
    // Get current request status
    const request = await (this.prisma as any).approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    if (request.status !== 'pending' && request.status !== 'in_progress') {
      throw new Error(`Cannot approve request with status: ${request.status}`);
    }

    // Get current step details
    const currentStep = await (this.prisma as any).approvalWorkflowStep.findFirst({
      where: { workflowId: request.workflowId, stepOrder: request.currentStep },
    });

    if (!currentStep) {
      throw new Error('Workflow step not found');
    }

    // Verify approver has permission
    const hasPermission = await this.verifyApprover(approverId, currentStep);
    if (!hasPermission) {
      throw new Error('User does not have permission to approve this request');
    }

    // Record the approval action
    await (this.prisma as any).approvalAction.create({
      data: {
        requestId,
        stepId: currentStep.id,
        approverId,
        action: 'approved',
        comments,
      },
    });

    // Check if all required approvals for this step are complete
    const stepComplete = await this.isStepComplete(requestId, currentStep.id);

    if (stepComplete) {
      // Move to next step or complete
      const nextStep = await this.getNextStep(request.workflowId, request.currentStep);

      if (nextStep) {
        // Move to next step
        await (this.prisma as any).approvalRequest.update({
          where: { id: requestId },
          data: { currentStep: nextStep.stepOrder, status: 'in_progress' },
        });

        // Notify next approvers
        await this.notifyApprovers(requestId, nextStep.stepOrder);

        return { status: 'in_progress', completed: false };
      } else {
        // All steps complete - approve the request
        await (this.prisma as any).approvalRequest.update({
          where: { id: requestId },
          data: {
            status: 'approved',
            approvedBy: approverId,
            approvedAt: new Date(),
            completedAt: new Date(),
          },
        });

        // Execute post-approval actions
        await this.executePostApprovalActions(requestId);

        return { status: 'approved', completed: true };
      }
    }

    return { status: 'in_progress', completed: false };
  }

  /**
   * Reject a request
   */
  async rejectRequest(
    requestId: string,
    rejectorId: string,
    rejectionReason: string,
  ): Promise<void> {
    const request = await (this.prisma as any).approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new Error('Approval request not found');
    }

    await (this.prisma as any).approvalRequest.update({
      where: { id: requestId },
      data: {
        status: 'rejected',
        rejectedBy: rejectorId,
        rejectedAt: new Date(),
        rejectionReason,
        completedAt: new Date(),
      },
    });

    // Record rejection action
    const currentStep = await (this.prisma as any).approvalWorkflowStep.findFirst({
      where: { workflowId: request.workflowId, stepOrder: request.currentStep },
    });

    if (currentStep) {
      await (this.prisma as any).approvalAction.create({
        data: {
          requestId,
          stepId: currentStep.id,
          approverId: rejectorId,
          action: 'rejected',
          comments: rejectionReason,
        },
      });
    }
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovals(userId: string): Promise<ApprovalRequest[]> {
    // Get user's role assignments
    const userRoles = await (this.prisma as any).userRoleAssignment.findMany({
      where: { userId, isActive: true },
      select: { roleId: true },
    });

    const roleIds = userRoles.map((r: any) => r.roleId);

    const requests = await (this.prisma as any).approvalRequest.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
      },
      include: {
        workflow: {
          include: {
            steps: true,
          },
        },
        requester: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: [
        { priority: 'asc' },
        { dueDate: 'asc' },
      ],
    });

    // Filter requests where user can approve current step
    return requests.filter((req: any) => {
      const currentStep = req.workflow.steps.find(
        (s: any) => s.stepOrder === req.currentStep
      );
      if (!currentStep) return false;

      if (currentStep.approverType === 'user') {
        return currentStep.approverUserId === userId;
      }
      if (currentStep.approverType === 'role') {
        return roleIds.includes(currentStep.approverRoleId);
      }
      return true; // For manager/department_head, simplified logic
    });
  }

  /**
   * Get approval history for a request
   */
  async getApprovalHistory(requestId: string): Promise<any[]> {
    return (this.prisma as any).approvalAction.findMany({
      where: { requestId },
      include: {
        step: true,
        approver: { select: { firstName: true, lastName: true } },
      },
      orderBy: { actionedAt: 'asc' },
    });
  }

  /**
   * Check if auto-approval conditions are met
   */
  private async checkAutoApproval(
    requestId: string,
    workflowId: string,
    totalAmount: number | null,
  ): Promise<void> {
    const workflow = await (this.prisma as any).approvalWorkflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) return;

    if (
      workflow.autoApproveBelowAmount &&
      totalAmount !== null &&
      totalAmount < workflow.autoApproveBelowAmount
    ) {
      // Auto-approve
      await (this.prisma as any).approvalRequest.update({
        where: { id: requestId },
        data: {
          status: 'approved',
          approvedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }
  }

  /**
   * Verify if user can approve the current step
   */
  private async verifyApprover(userId: string, step: any): Promise<boolean> {
    if (step.approverType === 'user') {
      return step.approverUserId === userId;
    }

    if (step.approverType === 'role') {
      const assignment = await (this.prisma as any).userRoleAssignment.findFirst({
        where: { userId, roleId: step.approverRoleId, isActive: true },
      });
      return !!assignment;
    }

    // For manager and department_head, simplified logic
    return true;
  }

  /**
   * Check if all approvals for a step are complete
   */
  private async isStepComplete(requestId: string, stepId: string): Promise<boolean> {
    const count = await (this.prisma as any).approvalAction.count({
      where: { requestId, stepId, action: 'approved' },
    });

    return count > 0;
  }

  /**
   * Get the next workflow step
   */
  private async getNextStep(workflowId: string, currentStepOrder: number): Promise<any> {
    return (this.prisma as any).approvalWorkflowStep.findFirst({
      where: { workflowId, stepOrder: { gt: currentStepOrder } },
      orderBy: { stepOrder: 'asc' },
    });
  }

  /**
   * Notify approvers for a given step
   */
  private async notifyApprovers(requestId: string, stepOrder: number): Promise<void> {
    console.log(`Notifying approvers for request ${requestId}, step ${stepOrder}`);
  }

  /**
   * Execute actions after approval is complete
   */
  private async executePostApprovalActions(requestId: string): Promise<void> {
    const request = await (this.prisma as any).approvalRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) return;

    // Execute entity-specific actions
    switch (request.entityType) {
      case 'payrun':
        await (this.prisma as any).payRun.update({
          where: { id: request.entityId },
          data: { status: 'APPROVED' },
        });
        break;
      // Add more entity types as needed
    }
  }
}
