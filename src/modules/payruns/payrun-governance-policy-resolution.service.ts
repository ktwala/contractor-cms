import { Injectable } from '@nestjs/common';
import { GovernancePolicyScope, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import {
  GOV_POLICY_KEY_BANK_FEE_TOLERANCE,
  GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
  GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
  GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../payroll-cycle/constants/governance-policy-keys';

export type ResolvedGovernancePolicy<T> = {
  value: T;
  source: 'registry' | 'default';
  policy_id: string | null;
  policy_key: string;
};

const SCOPE_RANK: Record<GovernancePolicyScope, number> = {
  [GovernancePolicyScope.PAY_GROUP]: 3,
  [GovernancePolicyScope.LEGAL_ENTITY]: 2,
  [GovernancePolicyScope.GLOBAL]: 1,
};

function coercePositiveNumber(raw: Prisma.JsonValue): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw >= 0) {
    return raw;
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in raw) {
    const v = (raw as { value: unknown }).value;
    if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      return v;
    }
  }
  return null;
}

function coercePositiveInt(raw: Prisma.JsonValue, fallback: number): number {
  const n = coercePositiveNumber(raw);
  if (n === null) return fallback;
  const i = Math.floor(n);
  if (i < 1) return 1;
  if (i > 10_000) return 10_000;
  return i;
}

export type ClosedPeriodMutationMode = 'STANDARD' | 'GOVERNED_PATHS_ONLY';

function coerceMutationMode(raw: Prisma.JsonValue): ClosedPeriodMutationMode {
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'mode' in raw) {
    const m = String((raw as { mode: unknown }).mode).toUpperCase();
    if (m === 'GOVERNED_PATHS_ONLY' || m === 'GOVERNED_ONLY') {
      return 'GOVERNED_PATHS_ONLY';
    }
  }
  return 'STANDARD';
}

@Injectable()
export class PayrunGovernancePolicyResolutionService {
  constructor(private readonly prisma: PrismaService) {}

  async resolvePayrunContext(payrunId: string): Promise<{ legalEntityId: string; payGroupId: string } | null> {
    const pr = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { payGroupId: true, payGroup: { select: { legalEntityId: true } } },
    });
    if (!pr?.payGroupId || !pr.payGroup?.legalEntityId) return null;
    return { legalEntityId: pr.payGroup.legalEntityId, payGroupId: pr.payGroupId };
  }

  async resolvePayGroupContext(payGroupId: string): Promise<{ legalEntityId: string; payGroupId: string } | null> {
    const pg = await this.prisma.payGroup.findUnique({
      where: { id: payGroupId },
      select: { id: true, legalEntityId: true },
    });
    if (!pg) return null;
    return { legalEntityId: pg.legalEntityId, payGroupId: pg.id };
  }

  async resolveNumberForContext(
    policyKey: string,
    ctx: { legalEntityId: string; payGroupId?: string | null },
    defaultValue: number,
  ): Promise<ResolvedGovernancePolicy<number>> {
    const or: Prisma.PayrollGovernancePolicyWhereInput[] = [
      { scope: GovernancePolicyScope.GLOBAL },
      { scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: ctx.legalEntityId },
    ];
    if (ctx.payGroupId) {
      or.push({ scope: GovernancePolicyScope.PAY_GROUP, payGroupId: ctx.payGroupId });
    }

    const rows = await this.prisma.payrollGovernancePolicy.findMany({
      where: {
        policyKey,
        supersededByPolicyId: null,
        OR: or,
      },
    });

    const sorted = [...rows].sort((a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope]);
    const best = sorted[0];
    const coerced = best ? coercePositiveNumber(best.currentValue) : null;
    if (coerced === null) {
      return { value: defaultValue, source: 'default', policy_id: null, policy_key: policyKey };
    }
    return {
      value: coerced,
      source: 'registry',
      policy_id: best.id,
      policy_key: policyKey,
    };
  }

  async resolveJustificationMinForContext(
    ctx: { legalEntityId: string; payGroupId?: string | null },
    defaultMin: number,
  ): Promise<ResolvedGovernancePolicy<number>> {
    const or: Prisma.PayrollGovernancePolicyWhereInput[] = [
      { scope: GovernancePolicyScope.GLOBAL },
      { scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: ctx.legalEntityId },
    ];
    if (ctx.payGroupId) {
      or.push({ scope: GovernancePolicyScope.PAY_GROUP, payGroupId: ctx.payGroupId });
    }
    const rows = await this.prisma.payrollGovernancePolicy.findMany({
      where: {
        policyKey: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
        supersededByPolicyId: null,
        OR: or,
      },
    });
    const sorted = [...rows].sort((a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope]);
    const best = sorted[0];
    if (!best) {
      return {
        value: defaultMin,
        source: 'default',
        policy_id: null,
        policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
      };
    }
    return {
      value: coercePositiveInt(best.currentValue, defaultMin),
      source: 'registry',
      policy_id: best.id,
      policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
    };
  }

  async resolveClosedPeriodMutationMode(
    ctx: { legalEntityId: string; payGroupId?: string | null },
  ): Promise<ResolvedGovernancePolicy<ClosedPeriodMutationMode>> {
    const or: Prisma.PayrollGovernancePolicyWhereInput[] = [
      { scope: GovernancePolicyScope.GLOBAL },
      { scope: GovernancePolicyScope.LEGAL_ENTITY, legalEntityId: ctx.legalEntityId },
    ];
    if (ctx.payGroupId) {
      or.push({ scope: GovernancePolicyScope.PAY_GROUP, payGroupId: ctx.payGroupId });
    }
    const rows = await this.prisma.payrollGovernancePolicy.findMany({
      where: {
        policyKey: GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
        supersededByPolicyId: null,
        OR: or,
      },
    });
    const sorted = [...rows].sort((a, b) => SCOPE_RANK[b.scope] - SCOPE_RANK[a.scope]);
    const best = sorted[0];
    if (!best) {
      return {
        value: 'STANDARD',
        source: 'default',
        policy_id: null,
        policy_key: GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
      };
    }
    return {
      value: coerceMutationMode(best.currentValue),
      source: 'registry',
      policy_id: best.id,
      policy_key: GOV_POLICY_KEY_CLOSED_PERIOD_MUTATION_POLICY,
    };
  }
}
