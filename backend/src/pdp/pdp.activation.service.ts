import { Injectable } from '@nestjs/common';
import { PrismaService } from '../core/database/prisma.service';
import { PdpAction, PdpContext, PdpDecisionType } from './pdp.types';
import { PdpActivationRule } from '@prisma/client';

export interface ActivationResolution {
  effectiveDecision: PdpDecisionType;
  isShadowMode: boolean;
  appliedRuleId?: string;
  enforcementLevel?: string;
}

@Injectable()
export class PdpActivationService {
  constructor(private readonly prisma: PrismaService) {}

  async resolve(
    action: PdpAction,
    context: PdpContext,
    evaluatedDecision: PdpDecisionType,
    reasonCode?: string
  ): Promise<ActivationResolution> {
    // Allows are always allowed
    if (evaluatedDecision === 'ALLOW') {
      return { effectiveDecision: 'ALLOW', isShadowMode: false };
    }

    // 1. Emergency Kill Switch
    if (process.env.PDP_EMERGENCY_OVERRIDE === 'true') {
      return { 
        effectiveDecision: 'ALLOW', 
        isShadowMode: true, 
        enforcementLevel: 'SHADOW' 
      };
    }

    // 2. Fetch Active Rules
    const activeRules = await this.prisma.pdpActivationRule.findMany({
      where: {
        isActive: true,
        environment: process.env.NODE_ENV || 'production',
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      orderBy: { priority: 'desc' }
    });

    // 3. Filter Matching Rules based on dimensions
    const matchingRules = activeRules.filter(rule => {
      if (rule.reasonCode && rule.reasonCode !== reasonCode) return false;
      if (rule.action && rule.action !== action) return false;
      if (rule.organizationId && rule.organizationId !== context.organizationId) return false;
      return true;
    });

    if (matchingRules.length === 0) {
      // Default fail-safe
      return { effectiveDecision: 'ALLOW', isShadowMode: true, enforcementLevel: 'SHADOW' };
    }

    // 4. Evaluate Precedence & Rollout Percent
    for (const rule of matchingRules) {
      if (rule.rolloutPercent < 100) {
        // Use random distribution for Canary. 
        // In a true system, we'd hash the context ID for deterministic stickiness.
        const isSelected = (Math.random() * 100) < rule.rolloutPercent;
        if (!isSelected) continue;
      }

      const level = rule.enforcementLevel as PdpDecisionType | 'SHADOW' | 'SOFT_BLOCK' | 'HARD_BLOCK';
      
      let effectiveDecision: PdpDecisionType = evaluatedDecision;
      let isShadowMode = false;

      switch (level) {
        case 'SHADOW':
          effectiveDecision = 'ALLOW';
          isShadowMode = true;
          break;
        case 'WARN':
          effectiveDecision = 'WARN';
          break;
        case 'APPROVAL_REQUIRED':
          effectiveDecision = 'APPROVAL_REQUIRED';
          break;
        case 'SOFT_BLOCK':
        case 'HARD_BLOCK':
          effectiveDecision = evaluatedDecision; // e.g., BLOCK or HOLD
          break;
        default:
          effectiveDecision = 'ALLOW';
          isShadowMode = true;
      }

      // If a rule downgrades a BLOCK to a WARN, we accept the downgrade.
      // But if evaluatedDecision is HOLD, and rule says SOFT_BLOCK, it stays HOLD.
      // The engine evaluated decision is the MAX strictness. We can only downgrade it via the rule.
      
      return { 
        effectiveDecision, 
        isShadowMode, 
        appliedRuleId: rule.id,
        enforcementLevel: rule.enforcementLevel
      };
    }

    // Fallback if all matching rules failed the canary percentage
    return { effectiveDecision: 'ALLOW', isShadowMode: true, enforcementLevel: 'SHADOW' };
  }
}
