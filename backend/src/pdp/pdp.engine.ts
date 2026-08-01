import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../core/database/prisma.service';
import { PdpActivationService } from './pdp.activation.service';
import { PdpAction, PdpContext, PdpDecision, PdpDecisionType, PdpRuleResult } from './pdp.types';
import { SupplierRuleEvaluator } from './rules/supplier.rule';
import { ContractorRuleEvaluator } from './rules/contractor.rule';
import { PoRuleEvaluator } from './rules/po.rule';
import { FinancialRuleEvaluator } from './rules/financial.rule';
import { WorkforceGovernanceRuleEvaluator } from './rules/workforce-governance.rule';

const SEVERITY_SCALE: Record<PdpDecisionType, number> = {
  ALLOW: 0,
  WARN: 1,
  APPROVAL_REQUIRED: 2,
  HOLD: 3,
  BLOCK: 4,
};

@Injectable()
export class PdpEngine {
  private supplierRule: SupplierRuleEvaluator;
  private contractorRule: ContractorRuleEvaluator;
  private poRule: PoRuleEvaluator;
  private financialRule: FinancialRuleEvaluator;
  private workforceGovernanceRule: WorkforceGovernanceRuleEvaluator;

  constructor(
    private readonly prisma: PrismaService,
    private readonly activationService: PdpActivationService
  ) {
    this.supplierRule = new SupplierRuleEvaluator(this.prisma);
    this.contractorRule = new ContractorRuleEvaluator(this.prisma);
    this.poRule = new PoRuleEvaluator(this.prisma);
    this.financialRule = new FinancialRuleEvaluator(this.prisma);
    this.workforceGovernanceRule = new WorkforceGovernanceRuleEvaluator(this.prisma);
  }

  /**
   * Policy Evaluation Service — evaluates authoritative governance truths; owns no facts.
   * (Implementation module: PDP — Policy Decision Point engine.)
   *
   * @param action The transaction being attempted
   * @param context The transaction context
   */
  async evaluate(action: PdpAction, context: PdpContext): Promise<PdpDecision> {
    try {
      // 1. Enforce Hierarchy & Evaluate
      const evaluators = [
        this.supplierRule,
        this.contractorRule,
        this.workforceGovernanceRule,
        this.poRule,
        this.financialRule,
      ];

      let mostRestrictiveResult: PdpRuleResult = { decision: 'ALLOW' };

      for (const evaluator of evaluators) {
        const result = await evaluator.evaluate(action, context);

        if (SEVERITY_SCALE[result.decision] > SEVERITY_SCALE[mostRestrictiveResult.decision]) {
          mostRestrictiveResult = result;
        }

        // Short-circuit if we hit the absolute ceiling (BLOCK)
        if (mostRestrictiveResult.decision === 'BLOCK') {
          break;
        }
      }

      // 2. Apply Activation Control Plane
      const resolution = await this.activationService.resolve(
        action,
        context,
        mostRestrictiveResult.decision,
        mostRestrictiveResult.reason_code
      );

      // 3. Exception Workflow Integration
      let exceptionOverrideId: string | undefined = undefined;

      if (
        (resolution.effectiveDecision === 'APPROVAL_REQUIRED' || resolution.enforcementLevel === 'SOFT_BLOCK') &&
        mostRestrictiveResult.reason_code
      ) {
        const activeException = await this.prisma.pdpExceptionRequest.findFirst({
          where: {
            reasonCode: mostRestrictiveResult.reason_code,
            action,
            status: 'APPROVED',
            expiresAt: { gt: new Date() },
            // If the context contains a specific supplier/po, match it. For safety, 
            // if we can't reliably map the target ID, we just check action & reasonCode.
            // A more robust implementation would tightly bind the contextTargetId.
          },
        });

        if (activeException) {
          resolution.effectiveDecision = 'ALLOW';
          exceptionOverrideId = activeException.id;
          
          // Log that the exception fired
          console.log(`[PDP_EXCEPTION] Decision overridden to ALLOW via exception: ${activeException.id}`);
        }
      }

      // 4. Audit Logging (Non-ALLOW decisions or overridden decisions must be audited)
      if (mostRestrictiveResult.decision !== 'ALLOW' || exceptionOverrideId) {
        await this.emitAuditEvent(
          action, 
          mostRestrictiveResult, 
          resolution.isShadowMode, 
          resolution.appliedRuleId, 
          resolution.enforcementLevel,
          exceptionOverrideId
        );
      }

      return {
        ...mostRestrictiveResult,
        evaluatedDecision: mostRestrictiveResult.decision,
        effectiveDecision: resolution.effectiveDecision,
        isShadow: resolution.isShadowMode,
      };

    } catch (error) {
      // 4. Fail Closed (ADR-008)
      console.error('[PDP_ENGINE_ERROR] Unhandled exception during evaluation', error);
      
      const failClosedResult: PdpRuleResult = {
        decision: 'HOLD',
        message: 'Governance Engine encountered an unexpected error and failed closed.',
      };

      await this.emitAuditEvent(action, failClosedResult, true);

      return {
        ...failClosedResult,
        evaluatedDecision: 'HOLD',
        effectiveDecision: 'HOLD',
        isShadow: true,
      };
    }
  }

  private async emitAuditEvent(
    action: PdpAction, 
    result: PdpRuleResult, 
    isShadow: boolean,
    appliedRuleId?: string,
    enforcementLevel?: string,
    exceptionOverrideId?: string
  ) {
    const severityMap: Record<string, string> = {
      ALLOW: 'INFO',
      WARN: 'WARNING',
      APPROVAL_REQUIRED: 'WARNING',
      HOLD: 'CRITICAL',
      BLOCK: 'CRITICAL',
    };

    const payload = {
      action: 'PDP_SHADOW_EVALUATION',
      targetType: 'PDP_DECISION',
      targetId: action, // e.g. SUBMIT_TIMESHEET
      severity: severityMap[result.decision] || 'INFO',
      tags: ['PDP', isShadow ? 'SHADOW' : 'ENFORCED'],
      metadata: {
        attemptedAction: action,
        evaluatedDecision: result.decision,
        reason_code: result.reason_code,
        message: result.message,
        appliedRuleId,
        enforcementLevel,
        exceptionOverrideId,
      },
    };

    try {
      await this.prisma.auditLog.create({
        data: payload,
      });
    } catch (err) {
      console.error('[PDP_AUDIT_ERROR] Failed to write to audit log:', err);
    }
  }
}
