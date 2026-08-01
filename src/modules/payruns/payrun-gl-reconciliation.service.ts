import { createHash } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PayrunGLReconciliationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { PayrunGovernancePolicyResolutionService } from './payrun-governance-policy-resolution.service';
import {
  GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE,
  GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
} from '../payroll-cycle/constants/governance-policy-keys';
import type { GlConfirmationImportDto } from './dto/gl-confirmation-import.dto';

export const PAYRUN_GL_OVERRIDE_PERMISSION = 'payrun:gl_override';
export const PAYRUN_GL_OVERRIDE_JUSTIFICATION_MIN = 20;
export const DEFAULT_GL_LINE_TOLERANCE = 0.05;
export const DEFAULT_GL_ROUNDING_EPSILON = 0.005;

export type PayrunGLOverrideHeaders = {
  overrideHeader?: string;
  justification?: string;
};

export type PayrunGLGateUser = {
  sub: string;
  permissions?: string[];
};

export type PayrunGLReconciliationResponse = {
  payrun_id: string;
  legal_entity_id: string;
  gl_batch_reference: string;
  gl_posting_hash: string | null;
  register_gross: number;
  register_net: number;
  register_paye: number;
  register_deductions: number;
  gl_gross: number;
  gl_net: number;
  gl_paye: number;
  gl_deductions: number;
  variance_amount: number;
  variance_dimensions: Record<string, number>;
  status: PayrunGLReconciliationStatus;
  review_required: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  source_type: string;
  soft_warnings: string[];
  blocked_reasons: string[];
  imported_at: string;
  /** GOV-4 — see post-close impact on source payrun. */
  post_close_reconciliation_impact_pending: boolean;
};

@Injectable()
export class PayrunGLReconciliationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly govPolicy: PayrunGovernancePolicyResolutionService,
  ) {}

  async getForPayrun(payrunId: string): Promise<PayrunGLReconciliationResponse | null> {
    const row = await this.prisma.payrunGLReconciliation.findUnique({ where: { payrunId } });
    if (!row) return null;
    const pr = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { glReconciliationImpacted: true },
    });
    return this.mapRow(row, pr?.glReconciliationImpacted === true);
  }

  /**
   * GOV-3C — blocks period close unless register↔GL control is clear or accounting override is audited.
   */
  async assertAllowsPeriodCloseGl(
    payrunId: string,
    user: PayrunGLGateUser,
    headers: PayrunGLOverrideHeaders,
    operation: 'payroll.period_close',
  ): Promise<void> {
    const row = await this.prisma.payrunGLReconciliation.findUnique({ where: { payrunId } });
    if (!row) {
      throw new ForbiddenException({
        code: 'PAYRUN_GL_GATE_BLOCKED',
        message: 'Import GL confirmation for this payrun before closing the payroll period (GOV-3C).',
        gl_reconciliation_required: true,
      });
    }

    const ok =
      row.status === PayrunGLReconciliationStatus.MATCH ||
      (row.status === PayrunGLReconciliationStatus.VARIANCE &&
        (row.reviewedAt != null || !row.reviewRequired));

    if (ok) {
      return;
    }

    const hasPerm = user.permissions?.includes(PAYRUN_GL_OVERRIDE_PERMISSION) === true;
    const approved = (headers.overrideHeader || '').trim().toLowerCase() === 'approved';
    const justification = (headers.justification || '').trim();
    const ctx = await this.govPolicy.resolvePayrunContext(payrunId);
    const jPol = ctx
      ? await this.govPolicy.resolveJustificationMinForContext(ctx, PAYRUN_GL_OVERRIDE_JUSTIFICATION_MIN)
      : {
          value: PAYRUN_GL_OVERRIDE_JUSTIFICATION_MIN,
          source: 'default' as const,
          policy_id: null,
          policy_key: GOV_POLICY_KEY_OVERRIDE_JUSTIFICATION_MIN_LENGTH,
        };
    const justificationOk = justification.length >= jPol.value;

    if (hasPerm && approved && justificationOk) {
      await this.audit.log({
        userId: user.sub,
        action: 'PAYRUN_GL_RECON_OVERRIDE',
        entityType: 'PayRun',
        entityId: payrunId,
        newValue: {
          operation,
          status: row.status,
          justification,
          blocked_reasons: row.blockedReasonsJson,
          soft_warnings: row.softWarningsJson,
          governance_policy_key: jPol.policy_key,
          governance_policy_id: jPol.policy_id,
          governance_policy_source: jPol.source,
          justification_min_length_applied: jPol.value,
        },
        reason: `gl_gate_override:${operation}`,
      });
      return;
    }

    throw new ForbiddenException({
      code: 'PAYRUN_GL_GATE_BLOCKED',
      message:
        'Register vs GL posting is not cleared for period close. Resolve blockers, complete GL variance review, or use an audited GL override.',
      status: row.status,
      blocked_reasons: row.blockedReasonsJson,
      soft_warnings: row.softWarningsJson,
      review_required: row.reviewRequired,
    });
  }

  async importGlConfirmation(
    payrunId: string,
    userId: string,
    dto: GlConfirmationImportDto,
  ): Promise<PayrunGLReconciliationResponse> {
    const payrun = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      include: {
        payGroup: { select: { legalEntityId: true } },
        employeeResults: { select: { gross: true, net: true, paye: true, deductionsTotal: true } },
      },
    });
    if (!payrun) {
      throw new NotFoundException({ code: 'NOT_FOUND', message: 'Payrun not found' });
    }
    const legalEntityId = payrun.payGroup.legalEntityId;
    const reg = this.aggregateRegister(payrun.employeeResults);

    const roundTol = await this.govPolicy.resolveNumberForContext(
      GOV_POLICY_KEY_GL_ROUNDING_TOLERANCE,
      { legalEntityId, payGroupId: payrun.payGroupId },
      DEFAULT_GL_ROUNDING_EPSILON,
    );
    const roundingEpsilon = roundTol.value;

    const hashInput = `${dto.gl_batch_reference.trim()}|${dto.csv_text ?? ''}`;
    const glPostingHash = createHash('sha256').update(hashInput, 'utf8').digest('hex');

    const duplicate = await this.prisma.payrunGLReconciliation.findFirst({
      where: {
        legalEntityId,
        glPostingHash,
        payrunId: { not: payrunId },
      },
    });

    const dims = {
      gross: reg.gross - dto.gl_gross,
      net: reg.net - dto.gl_net,
      paye: reg.paye - dto.gl_paye,
      deductions: reg.deductions - dto.gl_deductions,
    };
    const maxAbs = Math.max(Math.abs(dims.gross), Math.abs(dims.net), Math.abs(dims.paye), Math.abs(dims.deductions));

    const blockedReasons: string[] = [];
    if (duplicate) {
      blockedReasons.push('DUPLICATE_GL_POSTING');
    }
    if (Math.abs(dims.gross) > DEFAULT_GL_LINE_TOLERANCE) {
      blockedReasons.push('GROSS_MISMATCH');
    }
    if (Math.abs(dims.net) > DEFAULT_GL_LINE_TOLERANCE) {
      blockedReasons.push('NET_MISMATCH');
    }
    if (Math.abs(dims.paye) > DEFAULT_GL_LINE_TOLERANCE) {
      blockedReasons.push('PAYE_MISMATCH');
    }
    if (Math.abs(dims.deductions) > DEFAULT_GL_LINE_TOLERANCE) {
      blockedReasons.push('DEDUCTIONS_MISMATCH');
    }

    const softWarnings: string[] = [];
    if (dto.account_mapping_drift === true) {
      softWarnings.push('ACCOUNT_MAPPING_DRIFT');
    }
    if (dto.cost_center_variance === true) {
      softWarnings.push('COST_CENTER_VARIANCE');
    }
    if (dto.timing_lag === true) {
      softWarnings.push('TIMING_LAG');
    }
    if (dto.rounding_only === true) {
      softWarnings.push('ROUNDING_ONLY_DIFFERENCES');
    }

    const blockedUnique = [...new Set(blockedReasons)];
    const softUnique = [...new Set(softWarnings)];

    let status: PayrunGLReconciliationStatus;
    let reviewRequired = false;

    if (blockedUnique.length > 0) {
      status = PayrunGLReconciliationStatus.BLOCKED;
      reviewRequired = true;
    } else if (maxAbs > roundingEpsilon) {
      status = PayrunGLReconciliationStatus.VARIANCE;
      reviewRequired = true;
    } else if (softUnique.length > 0) {
      status = PayrunGLReconciliationStatus.VARIANCE;
      reviewRequired = false;
    } else {
      status = PayrunGLReconciliationStatus.MATCH;
    }

    const varianceAmount = maxAbs;

    const row = await this.prisma.payrunGLReconciliation.upsert({
      where: { payrunId },
      create: {
        legalEntityId,
        payrunId,
        glBatchReference: dto.gl_batch_reference.trim(),
        glPostingHash,
        registerGross: new Prisma.Decimal(reg.gross.toFixed(2)),
        registerNet: new Prisma.Decimal(reg.net.toFixed(2)),
        registerPaye: new Prisma.Decimal(reg.paye.toFixed(2)),
        registerDeductions: new Prisma.Decimal(reg.deductions.toFixed(2)),
        glGross: new Prisma.Decimal(dto.gl_gross.toFixed(2)),
        glNet: new Prisma.Decimal(dto.gl_net.toFixed(2)),
        glPaye: new Prisma.Decimal(dto.gl_paye.toFixed(2)),
        glDeductions: new Prisma.Decimal(dto.gl_deductions.toFixed(2)),
        varianceAmount: new Prisma.Decimal(varianceAmount.toFixed(4)),
        varianceDimensionsJson: dims,
        status,
        reviewRequired,
        reviewedByUserId: null,
        reviewedAt: null,
        sourceType: dto.source_type,
        softWarningsJson: softUnique,
        blockedReasonsJson: blockedUnique,
        importedByUserId: userId,
      },
      update: {
        glBatchReference: dto.gl_batch_reference.trim(),
        glPostingHash,
        registerGross: new Prisma.Decimal(reg.gross.toFixed(2)),
        registerNet: new Prisma.Decimal(reg.net.toFixed(2)),
        registerPaye: new Prisma.Decimal(reg.paye.toFixed(2)),
        registerDeductions: new Prisma.Decimal(reg.deductions.toFixed(2)),
        glGross: new Prisma.Decimal(dto.gl_gross.toFixed(2)),
        glNet: new Prisma.Decimal(dto.gl_net.toFixed(2)),
        glPaye: new Prisma.Decimal(dto.gl_paye.toFixed(2)),
        glDeductions: new Prisma.Decimal(dto.gl_deductions.toFixed(2)),
        varianceAmount: new Prisma.Decimal(varianceAmount.toFixed(4)),
        varianceDimensionsJson: dims,
        status,
        reviewRequired,
        reviewedByUserId: null,
        reviewedAt: null,
        sourceType: dto.source_type,
        softWarningsJson: softUnique,
        blockedReasonsJson: blockedUnique,
        importedByUserId: userId,
      },
    });

    const auditAction =
      status === PayrunGLReconciliationStatus.MATCH ? 'PAYRUN_GL_RECON_MATCH' : 'PAYRUN_GL_RECON_VARIANCE';

    await this.audit.log({
      userId,
      action: auditAction,
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: {
        status,
        variance_dimensions: dims,
        variance_amount: varianceAmount,
        blocked_reasons: blockedUnique,
        soft_warnings: softUnique,
        governance_policy_key: roundTol.policy_key,
        governance_policy_id: roundTol.policy_id,
        governance_policy_source: roundTol.source,
        gl_rounding_tolerance_applied: roundingEpsilon,
      },
      reason: 'payrun_gl_reconciliation_import',
    });

    const impact = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { glReconciliationImpacted: true },
    });
    return this.mapRow(row, impact?.glReconciliationImpacted === true);
  }

  async acknowledgeVarianceReview(payrunId: string, userId: string, _note?: string): Promise<PayrunGLReconciliationResponse> {
    const row = await this.prisma.payrunGLReconciliation.findUnique({ where: { payrunId } });
    if (!row) {
      throw new NotFoundException({
        code: 'GL_RECON_NOT_FOUND',
        message: 'Import GL confirmation before acknowledging review',
      });
    }
    if (row.status !== PayrunGLReconciliationStatus.VARIANCE) {
      throw new BadRequestException({
        code: 'GL_RECON_REVIEW_INVALID',
        message: 'Review acknowledgement only applies when status is VARIANCE',
      });
    }
    if (!row.reviewRequired) {
      throw new BadRequestException({
        code: 'GL_RECON_REVIEW_INVALID',
        message: 'This GL variance record does not require a separate review acknowledgement',
      });
    }
    if (row.reviewedAt) {
      throw new BadRequestException({
        code: 'GL_RECON_ALREADY_REVIEWED',
        message: 'GL reconciliation review was already recorded',
      });
    }

    const updated = await this.prisma.payrunGLReconciliation.update({
      where: { payrunId },
      data: {
        reviewedByUserId: userId,
        reviewedAt: new Date(),
        reviewRequired: false,
      },
    });

    await this.audit.log({
      userId,
      action: 'PAYRUN_GL_RECON_VARIANCE',
      entityType: 'PayRun',
      entityId: payrunId,
      newValue: { reviewed: true },
      reason: 'payrun_gl_reconciliation_variance_acknowledged',
    });

    const impact = await this.prisma.payRun.findUnique({
      where: { id: payrunId },
      select: { glReconciliationImpacted: true },
    });
    return this.mapRow(updated, impact?.glReconciliationImpacted === true);
  }

  private aggregateRegister(
    rows: { gross: unknown; net: unknown; paye: unknown; deductionsTotal: unknown }[],
  ): { gross: number; net: number; paye: number; deductions: number } {
    let gross = 0;
    let net = 0;
    let paye = 0;
    let deductions = 0;
    for (const r of rows) {
      gross += Number(r.gross ?? 0);
      net += Number(r.net ?? 0);
      paye += Number(r.paye ?? 0);
      deductions += Number(r.deductionsTotal ?? 0);
    }
    return { gross, net, paye, deductions };
  }

  private mapRow(row: {
    payrunId: string;
    legalEntityId: string;
    glBatchReference: string;
    glPostingHash: string | null;
    registerGross: unknown;
    registerNet: unknown;
    registerPaye: unknown;
    registerDeductions: unknown;
    glGross: unknown;
    glNet: unknown;
    glPaye: unknown;
    glDeductions: unknown;
    varianceAmount: unknown;
    varianceDimensionsJson: unknown;
    status: PayrunGLReconciliationStatus;
    reviewRequired: boolean;
    reviewedByUserId: string | null;
    reviewedAt: Date | null;
    sourceType: string;
    softWarningsJson: unknown;
    blockedReasonsJson: unknown;
    importedAt: Date;
  }, postCloseReconciliationImpactPending: boolean): PayrunGLReconciliationResponse {
    const vd =
      row.varianceDimensionsJson && typeof row.varianceDimensionsJson === 'object' && !Array.isArray(row.varianceDimensionsJson)
        ? (row.varianceDimensionsJson as Record<string, number>)
        : {};
    return {
      payrun_id: row.payrunId,
      legal_entity_id: row.legalEntityId,
      gl_batch_reference: row.glBatchReference,
      gl_posting_hash: row.glPostingHash,
      register_gross: Number(row.registerGross),
      register_net: Number(row.registerNet),
      register_paye: Number(row.registerPaye),
      register_deductions: Number(row.registerDeductions),
      gl_gross: Number(row.glGross),
      gl_net: Number(row.glNet),
      gl_paye: Number(row.glPaye),
      gl_deductions: Number(row.glDeductions),
      variance_amount: Number(row.varianceAmount),
      variance_dimensions: vd,
      status: row.status,
      review_required: row.reviewRequired,
      reviewed_by: row.reviewedByUserId,
      reviewed_at: row.reviewedAt?.toISOString() ?? null,
      source_type: row.sourceType,
      soft_warnings: Array.isArray(row.softWarningsJson) ? (row.softWarningsJson as string[]) : [],
      blocked_reasons: Array.isArray(row.blockedReasonsJson) ? (row.blockedReasonsJson as string[]) : [],
      imported_at: row.importedAt.toISOString(),
      post_close_reconciliation_impact_pending: postCloseReconciliationImpactPending,
    };
  }
}
