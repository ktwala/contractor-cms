import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { PdpEngine } from './pdp.engine';
import { CreateActivationRuleDto } from './dto/create-activation-rule.dto';
import { PreviewEvaluationDto } from './dto/preview-evaluation.dto';
import { PdpAction, PdpDecision } from './pdp.types';

@Injectable()
export class PdpActivationAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pdpEngine: PdpEngine
  ) {}

  async listRules() {
    const rules = await this.prisma.pdpActivationRule.findMany({
      orderBy: { priority: 'desc' },
    });
    
    return {
      rules,
      isEmergencyOverrideActive: process.env.PDP_EMERGENCY_OVERRIDE === 'true'
    };
  }

  async createRule(dto: CreateActivationRuleDto, actorId: string) {
    this.validateSafetyGuardrails(dto);

    const rule = await this.prisma.pdpActivationRule.create({
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        updatedBy: actorId,
      },
    });

    await this.emitAudit('CREATE', null, rule, actorId, dto.notes);
    return rule;
  }

  async updateRule(id: string, dto: CreateActivationRuleDto, actorId: string) {
    this.validateSafetyGuardrails(dto);

    const before = await this.prisma.pdpActivationRule.findUnique({ where: { id } });
    if (!before) throw new BadRequestException('Rule not found');

    const rule = await this.prisma.pdpActivationRule.update({
      where: { id },
      data: {
        ...dto,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        updatedBy: actorId,
      },
    });

    await this.emitAudit('UPDATE', before, rule, actorId, dto.notes);
    return rule;
  }

  async disableRule(id: string, actorId: string, notes?: string) {
    const before = await this.prisma.pdpActivationRule.findUnique({ where: { id } });
    if (!before) throw new BadRequestException('Rule not found');

    const rule = await this.prisma.pdpActivationRule.update({
      where: { id },
      data: {
        isActive: false,
        updatedBy: actorId,
      },
    });

    await this.emitAudit('DISABLE', before, rule, actorId, notes);
    return rule;
  }

  async previewEvaluation(dto: PreviewEvaluationDto): Promise<PdpDecision> {
    const context = {
      ...dto,
      transactionDate: new Date(dto.transactionDate),
    };
    return this.pdpEngine.evaluate(dto.action as PdpAction, context);
  }

  // --- Private Safety Helpers ---

  private validateSafetyGuardrails(dto: CreateActivationRuleDto) {
    // 1. Rollout Percent
    if (dto.rolloutPercent !== undefined && (dto.rolloutPercent < 0 || dto.rolloutPercent > 100)) {
      throw new BadRequestException('rolloutPercent must be between 0 and 100');
    }

    const env = dto.environment || 'production';
    const isHardBlock = dto.enforcementLevel === 'HARD_BLOCK';

    // 2. HARD_BLOCK in Production requires explicit approval
    if (env === 'production' && isHardBlock && !dto.approvedBy) {
      throw new BadRequestException('HARD_BLOCK in production requires an explicit approvedBy value.');
    }

    // 3. Global HARD_BLOCK requires an expiry date (unless strictly approved, but we force expiry to be safe)
    const isGlobal = !dto.organizationId && !dto.domain;
    if (isGlobal && isHardBlock && !dto.expiresAt) {
      // We will allow it if approvedBy is present, but let's strictly require expiresAt for global blocks to prevent permanent outages
      throw new BadRequestException('Global HARD_BLOCK requires an expiresAt date to prevent permanent platform lockouts.');
    }

    const validLevels = ['SHADOW', 'WARN', 'APPROVAL_REQUIRED', 'SOFT_BLOCK', 'HARD_BLOCK'];
    if (!validLevels.includes(dto.enforcementLevel)) {
      throw new BadRequestException(`Invalid enforcementLevel. Allowed: ${validLevels.join(', ')}`);
    }

    const validActions = ['SUBMIT_TIMESHEET', 'SUBMIT_INVOICE'];
    if (dto.action && !validActions.includes(dto.action)) {
      throw new BadRequestException(`Invalid action. Allowed: ${validActions.join(', ')}`);
    }
  }

  private async emitAudit(operation: string, before: any, after: any, actorId: string, reason?: string) {
    await this.prisma.auditLog.create({
      data: {
        action: 'PDP_ACTIVATION_CHANGE',
        targetType: 'PdpActivationRule',
        targetId: after.id,
        severity: after.enforcementLevel === 'HARD_BLOCK' ? 'CRITICAL' : 'WARNING',
        tags: ['PDP', 'ADMIN', operation],
        metadata: {
          actorId,
          reason,
          changes: { before, after }
        }
      }
    });
  }
}
