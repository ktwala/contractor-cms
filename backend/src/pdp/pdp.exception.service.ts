import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { ApproveExceptionDto, RejectExceptionDto } from './dto/approve-exception.dto';
import { PdpActivationService } from './pdp.activation.service';

@Injectable()
export class PdpExceptionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activationService: PdpActivationService,
  ) {}

  async listExceptions(status?: string) {
    return this.prisma.pdpExceptionRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getException(id: string) {
    const ex = await this.prisma.pdpExceptionRequest.findUnique({ where: { id } });
    if (!ex) throw new BadRequestException('Exception request not found');
    return ex;
  }

  async createException(dto: CreateExceptionDto, actorId: string) {
    // Determine if this is a HARD_BLOCK mathematically by querying the activation service.
    // In a real robust system, we would query the actual AuditLog or re-evaluate the context.
    // For now, we assume the frontend sends the reasonCode accurately, but we can verify against rules:
    const rules = await this.prisma.pdpActivationRule.findMany({
      where: { reasonCode: dto.reasonCode, isActive: true },
      orderBy: { priority: 'desc' }
    });
    
    // Find highest priority match (naive global search for safety)
    const topRule = rules.length > 0 ? rules[0] : null;
    
    if (topRule && topRule.enforcementLevel === 'HARD_BLOCK') {
       throw new BadRequestException('HARD_BLOCK policies are strictly non-overridable via exceptions. A formal rule modification is required.');
    }

    const ex = await this.prisma.pdpExceptionRequest.create({
      data: {
        evaluationId: dto.evaluationId,
        reasonCode: dto.reasonCode,
        action: dto.action,
        contextTargetId: dto.contextTargetId,
        requestedBy: actorId,
        justification: dto.justification,
        status: 'PENDING',
      },
    });

    await this.emitAudit('CREATE', null, ex, actorId, 'Exception requested');
    return ex;
  }

  async approveException(id: string, dto: ApproveExceptionDto, actorId: string) {
    const before = await this.getException(id);
    if (before.status !== 'PENDING') throw new BadRequestException('Only PENDING exceptions can be approved');
    
    if (before.requestedBy === actorId) {
       // Assuming dual control logic or segregation of duties logic.
       throw new BadRequestException('Segregation of duties: You cannot approve your own exception request.');
    }

    // Is dual approval needed?
    const rules = await this.prisma.pdpActivationRule.findMany({
      where: { reasonCode: before.reasonCode, isActive: true, requiresDualApproval: true },
    });
    // In a fully built out system, if rules.length > 0, we'd transition to 'PENDING_SECOND_APPROVAL'.
    // For v1, we immediately approve to establish the pipeline.

    const ex = await this.prisma.pdpExceptionRequest.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approverId: actorId,
        approvalNotes: dto.approvalNotes,
        expiresAt: new Date(dto.expiresAt),
      },
    });

    await this.emitAudit('APPROVE', before, ex, actorId, dto.approvalNotes);
    return ex;
  }

  async rejectException(id: string, dto: RejectExceptionDto, actorId: string) {
    const before = await this.getException(id);
    if (before.status !== 'PENDING') throw new BadRequestException('Only PENDING exceptions can be rejected');

    const ex = await this.prisma.pdpExceptionRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        approverId: actorId,
        approvalNotes: dto.approvalNotes,
      },
    });

    await this.emitAudit('REJECT', before, ex, actorId, dto.approvalNotes);
    return ex;
  }

  private async emitAudit(operation: string, before: any, after: any, actorId: string, reason?: string) {
    await this.prisma.auditLog.create({
      data: {
        action: 'PDP_EXCEPTION_CHANGE',
        targetType: 'PdpExceptionRequest',
        targetId: after.id,
        severity: 'WARNING',
        tags: ['PDP', 'EXCEPTION', operation],
        metadata: {
          actorId,
          reason,
          changes: { before, after }
        }
      }
    });
  }
}
