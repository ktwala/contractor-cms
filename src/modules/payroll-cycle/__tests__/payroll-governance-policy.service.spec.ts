import { BadRequestException, ForbiddenException, GoneException } from '@nestjs/common';
import { GovernancePolicyDraftStatus, GovernancePolicyScope } from '@prisma/client';
import { PayrollGovernancePolicyService } from '../services/payroll-governance-policy.service';
import { computeGovernancePolicyImpactPayloadHash } from '../services/governance-policy-payload-hash';
import { GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD } from '../constants/governance-policy-keys';

describe('PayrollGovernancePolicyService (GOV-6A / GOV-6C / GOV-7A / GOV-7B / GOV-7B-2)', () => {
  const audit = { log: jest.fn() };

  it('listCurrentPolicies rejects unscoped query for non-global user', async () => {
    const prisma = {
      payrollGovernancePolicy: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.listCurrentPolicies(
        { sub: 'u1', legalEntityAccess: ['le1'], hasGlobalScope: false },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payrollGovernancePolicy.findMany).not.toHaveBeenCalled();
  });

  it('listCurrentPolicies allows unscoped query for global user', async () => {
    const prisma = {
      payrollGovernancePolicy: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const rows = await service.listCurrentPolicies({ sub: 'u1', hasGlobalScope: true }, {});
    expect(rows).toEqual([]);
    expect(prisma.payrollGovernancePolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { supersededByPolicyId: null } }),
    );
  });

  it('createGovernancePolicyDraft denies GLOBAL policy for non-global user', async () => {
    const prisma = { payrollGovernancePolicyDraft: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const effIso = new Date('2026-02-01T00:00:00.000Z').toISOString();
    const impactHash = computeGovernancePolicyImpactPayloadHash({
      policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
      scope: GovernancePolicyScope.GLOBAL,
      legal_entity_id: null,
      pay_group_id: null,
      current_value: 0.02,
      effective_from_iso: effIso,
    });
    await expect(
      service.createGovernancePolicyDraft(
        { sub: 'u1', legalEntityAccess: ['le1'], hasGlobalScope: false },
        'user1',
        {
          policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
          scope: GovernancePolicyScope.GLOBAL,
          current_value: 0.02,
          approval_reference: 'APPR-1',
          effective_from: effIso,
          impact_preview_hash: impactHash,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payrollGovernancePolicyDraft.create).not.toHaveBeenCalled();
  });

  it('createPolicyVersion is gone (GOV-7B — use draft → approve → activate)', async () => {
    const prisma = { $transaction: jest.fn() };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.createPolicyVersion(
        { sub: 'u1', hasGlobalScope: true },
        'actor-1',
        {
          policy_key: 'gov.demo',
          scope: GovernancePolicyScope.GLOBAL,
          current_value: {},
          approval_reference: 'APPR-42',
          effective_from: '2026-01-15T00:00:00.000Z',
          impact_preview_hash: 'a'.repeat(64),
        },
      ),
    ).rejects.toBeInstanceOf(GoneException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('activateGovernancePolicyDraft supersedes prior head and audits (GOV-7B)', async () => {
    const eff = new Date('2026-01-15T00:00:00.000Z');
    const effIso = eff.toISOString();
    const impactHash = computeGovernancePolicyImpactPayloadHash({
      policy_key: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legal_entity_id: null,
      pay_group_id: null,
      current_value: { tolerance: 0.05 },
      effective_from_iso: effIso,
    });
    const draftRow = {
      id: 'draft-1',
      policyKey: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      proposedValue: { tolerance: 0.05 },
      effectiveFrom: eff,
      impactPreviewHash: impactHash,
      requestedByUserId: 'requester',
      approvedByUserId: 'approver',
      approvedAt: new Date(),
      status: GovernancePolicyDraftStatus.APPROVED,
      activationPolicyId: null,
      approvalReference: 'APPR-42',
      createdAt: eff,
      updatedAt: eff,
    };
    const prior = {
      id: 'prior-id',
      policyKey: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      supersededByPolicyId: null,
    };
    const createdRow = {
      id: 'new-id',
      policyKey: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      currentValue: { tolerance: 0.05 },
      effectiveFrom: eff,
      changedByUserId: 'activator',
      approvalReference: 'APPR-42',
      supersededByPolicyId: null,
      createdAt: eff,
      updatedAt: eff,
    };
    const tx = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue({ ...draftRow, status: GovernancePolicyDraftStatus.APPROVED }),
        update: jest.fn().mockResolvedValue({}),
      },
      payrollGovernancePolicy: {
        findFirst: jest.fn().mockResolvedValue(prior),
        create: jest.fn().mockResolvedValue(createdRow),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue(draftRow),
      },
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const out = await service.activateGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'activator', 'draft-1');
    expect(out.id).toBe('new-id');
    expect(tx.payrollGovernancePolicy.update).toHaveBeenCalledWith({
      where: { id: 'prior-id' },
      data: { supersededByPolicyId: 'new-id' },
    });
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'GOV_POLICY_VERSION_CREATE',
        entityType: 'PayrollGovernancePolicy',
        entityId: 'new-id',
        newValue: expect.objectContaining({
          governance_policy_draft_id: 'draft-1',
          impact_preview_hash: impactHash,
        }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOV_POLICY_DRAFT_ACTIVATE', entityId: 'draft-1' }),
    );
  });

  it('rejectGovernancePolicyDraft rejects when actor is requester (GOV-7B-2)', async () => {
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          policyKey: 'k',
          scope: GovernancePolicyScope.GLOBAL,
          legalEntityId: null,
          payGroupId: null,
          status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
          requestedByUserId: 'same-user',
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.rejectGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'same-user', 'd1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payrollGovernancePolicyDraft.update).not.toHaveBeenCalled();
  });

  it('rejectGovernancePolicyDraft sets REJECTED and audits (GOV-7B-2)', async () => {
    const eff = new Date('2026-02-01T00:00:00.000Z');
    const draft = {
      id: 'd-rej',
      policyKey: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      proposedValue: {},
      effectiveFrom: eff,
      impactPreviewHash: 'h',
      requestedByUserId: 'requester',
      approvedByUserId: null,
      approvedAt: null,
      status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
      activationPolicyId: null,
      approvalReference: 'A',
      createdAt: eff,
      updatedAt: eff,
    };
    const updated = { ...draft, status: GovernancePolicyDraftStatus.REJECTED };
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue(draft),
        update: jest.fn().mockResolvedValue(updated),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const out = await service.rejectGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'approver-1', 'd-rej');
    expect(out.status).toBe('REJECTED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOV_POLICY_DRAFT_REJECT', entityId: 'd-rej' }),
    );
  });

  it('cancelGovernancePolicyDraft rejects when actor is not requester (GOV-7B-2)', async () => {
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          policyKey: 'k',
          scope: GovernancePolicyScope.GLOBAL,
          legalEntityId: null,
          payGroupId: null,
          status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
          requestedByUserId: 'requester',
        }),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.cancelGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'other-user', 'd1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.payrollGovernancePolicyDraft.update).not.toHaveBeenCalled();
  });

  it('cancelGovernancePolicyDraft sets CANCELLED and audits (GOV-7B-2)', async () => {
    const eff = new Date('2026-02-02T00:00:00.000Z');
    const draft = {
      id: 'd-can',
      policyKey: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      proposedValue: {},
      effectiveFrom: eff,
      impactPreviewHash: 'h',
      requestedByUserId: 'requester',
      approvedByUserId: null,
      approvedAt: null,
      status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
      activationPolicyId: null,
      approvalReference: 'A',
      createdAt: eff,
      updatedAt: eff,
    };
    const updated = { ...draft, status: GovernancePolicyDraftStatus.CANCELLED };
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue(draft),
        update: jest.fn().mockResolvedValue(updated),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const out = await service.cancelGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'requester', 'd-can');
    expect(out.status).toBe('CANCELLED');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOV_POLICY_DRAFT_CANCEL', entityId: 'd-can' }),
    );
  });

  it('activateGovernancePolicyDraft rejects REJECTED draft (GOV-7B-2)', async () => {
    const eff = new Date('2026-02-03T00:00:00.000Z');
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd-bad',
          policyKey: 'gov.demo',
          scope: GovernancePolicyScope.GLOBAL,
          legalEntityId: null,
          payGroupId: null,
          proposedValue: {},
          effectiveFrom: eff,
          impactPreviewHash: 'a'.repeat(64),
          requestedByUserId: 'r',
          status: GovernancePolicyDraftStatus.REJECTED,
          approvalReference: 'A',
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.activateGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'activator', 'd-bad'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('approveGovernancePolicyDraft rejects when approver is requester', async () => {
    const prisma = {
      payrollGovernancePolicyDraft: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'd1',
          policyKey: 'k',
          scope: GovernancePolicyScope.GLOBAL,
          legalEntityId: null,
          payGroupId: null,
          status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
          requestedByUserId: 'same-user',
        }),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.approveGovernancePolicyDraft({ sub: 'u1', hasGlobalScope: true }, 'same-user', 'd1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('createGovernancePolicyDraft writes CREATE + SUBMIT audits', async () => {
    const eff = new Date('2026-01-20T00:00:00.000Z');
    const impactHash = computeGovernancePolicyImpactPayloadHash({
      policy_key: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legal_entity_id: null,
      pay_group_id: null,
      current_value: { x: 1 },
      effective_from_iso: eff.toISOString(),
    });
    const createdDraft = {
      id: 'draft-new',
      policyKey: 'gov.demo',
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      proposedValue: { x: 1 },
      effectiveFrom: eff,
      impactPreviewHash: impactHash,
      requestedByUserId: 'actor-1',
      approvedByUserId: null,
      approvedAt: null,
      status: GovernancePolicyDraftStatus.PENDING_APPROVAL,
      activationPolicyId: null,
      approvalReference: 'APPR-9',
      createdAt: eff,
      updatedAt: eff,
    };
    const prisma = {
      payrollGovernancePolicyDraft: {
        create: jest.fn().mockResolvedValue(createdDraft),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const dto = await service.createGovernancePolicyDraft(
      { sub: 'u1', hasGlobalScope: true },
      'actor-1',
      {
        policy_key: 'gov.demo',
        scope: GovernancePolicyScope.GLOBAL,
        current_value: { x: 1 },
        approval_reference: 'APPR-9',
        effective_from: eff.toISOString(),
        impact_preview_hash: impactHash,
      },
    );
    expect(dto.id).toBe('draft-new');
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'GOV_POLICY_DRAFT_CREATE' }));
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'GOV_POLICY_DRAFT_SUBMIT' }));
  });

  it('createGovernancePolicyDraft rejects missing impact_preview_hash', async () => {
    const prisma = { payrollGovernancePolicyDraft: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.createGovernancePolicyDraft(
        { sub: 'u1', hasGlobalScope: true },
        'user1',
        {
          policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
          scope: GovernancePolicyScope.GLOBAL,
          current_value: 0.02,
          approval_reference: 'APPR-1',
        } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payrollGovernancePolicyDraft.create).not.toHaveBeenCalled();
  });

  it('createGovernancePolicyDraft rejects impact_preview_hash mismatch', async () => {
    const prisma = { payrollGovernancePolicyDraft: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.createGovernancePolicyDraft(
        { sub: 'u1', hasGlobalScope: true },
        'user1',
        {
          policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
          scope: GovernancePolicyScope.GLOBAL,
          current_value: 0.02,
          approval_reference: 'APPR-1',
          impact_preview_hash: '0'.repeat(64),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payrollGovernancePolicyDraft.create).not.toHaveBeenCalled();
  });

  it('createGovernancePolicyDraft rejects blank approval_reference', async () => {
    const prisma = { payrollGovernancePolicyDraft: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.createGovernancePolicyDraft(
        { sub: 'u1', hasGlobalScope: true },
        'user1',
        {
          policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
          scope: GovernancePolicyScope.GLOBAL,
          current_value: 0.02,
          approval_reference: '   ',
          impact_preview_hash: 'a'.repeat(64),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payrollGovernancePolicyDraft.create).not.toHaveBeenCalled();
  });

  it('createGovernancePolicyDraft rejects invalid value shape for known key', async () => {
    const prisma = { payrollGovernancePolicyDraft: { create: jest.fn() }, $transaction: jest.fn() };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    await expect(
      service.createGovernancePolicyDraft(
        { sub: 'u1', hasGlobalScope: true },
        'user1',
        {
          policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
          scope: GovernancePolicyScope.GLOBAL,
          current_value: -1,
          approval_reference: 'APPR-1',
          impact_preview_hash: 'b'.repeat(64),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.payrollGovernancePolicyDraft.create).not.toHaveBeenCalled();
  });

  it('listPolicyVersionHistory queries full chain for scope dimensions', async () => {
    const histRow = {
      id: 'v1',
      policyKey: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
      scope: GovernancePolicyScope.GLOBAL,
      legalEntityId: null,
      payGroupId: null,
      currentValue: 0.01,
      effectiveFrom: new Date('2026-01-01T00:00:00.000Z'),
      changedByUserId: 'u',
      approvalReference: 'A',
      supersededByPolicyId: 'v2',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const prisma = {
      payrollGovernancePolicy: {
        findMany: jest.fn().mockResolvedValue([histRow]),
      },
      $transaction: jest.fn(),
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const rows = await service.listPolicyVersionHistory(
      { sub: 'u1', hasGlobalScope: true },
      {
        policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
        scope: GovernancePolicyScope.GLOBAL,
      },
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('v1');
    expect(prisma.payrollGovernancePolicy.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          policyKey: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
          scope: GovernancePolicyScope.GLOBAL,
        }),
      }),
    );
  });

  it('governancePolicyImpactPreview returns payload_hash and RELAXED diff (GOV-7A)', async () => {
    const prisma = {
      payrollGovernancePolicy: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'prior',
          currentValue: { value: 0.05 },
        }),
      },
      payRun: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new PayrollGovernancePolicyService(prisma as any, audit as any);
    const out = await service.governancePolicyImpactPreview(
      { sub: 'u1', hasGlobalScope: true },
      'actor',
      {
        policy_key: GOV_POLICY_KEY_FINANCIAL_NET_VARIANCE_THRESHOLD,
        scope: GovernancePolicyScope.GLOBAL,
        current_value: { value: 0.1 },
        effective_from: '2026-05-08T00:00:00.000Z',
      },
    );
    expect(out.payload_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(out.diff.type).toBe('THRESHOLD_CHANGE');
    expect(out.diff.direction).toBe('RELAXED');
    expect(out.simulation.quality).toBe('HEURISTIC');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'GOV_POLICY_IMPACT_PREVIEW' }),
    );
  });
});
