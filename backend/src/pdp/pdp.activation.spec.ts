import { PdpActivationService } from './pdp.activation.service';
import { PrismaService } from '../core/database/prisma.service';

const mockPrisma = {
  pdpActivationRule: {
    findMany: jest.fn(),
  },
} as unknown as PrismaService;

describe('PDP Activation Control Plane', () => {
  let service: PdpActivationService;

  beforeEach(() => {
    service = new PdpActivationService(mockPrisma);
    jest.clearAllMocks();
    delete process.env.PDP_EMERGENCY_OVERRIDE;
    process.env.NODE_ENV = 'test';
  });

  it('Default Fail-Safe: No rules -> returns SHADOW', async () => {
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([]);
    
    const result = await service.resolve('SUBMIT_TIMESHEET', { supplierId: 's1', transactionDate: new Date() }, 'BLOCK', 'POST_EXPIRY_LABOR_PROHIBITED');
    
    expect(result.isShadowMode).toBe(true);
    expect(result.effectiveDecision).toBe('ALLOW');
    expect(result.enforcementLevel).toBe('SHADOW');
  });

  it('Emergency Kill Switch: Forces SHADOW instantly', async () => {
    process.env.PDP_EMERGENCY_OVERRIDE = 'true';
    
    const result = await service.resolve('SUBMIT_TIMESHEET', { supplierId: 's1', transactionDate: new Date() }, 'BLOCK', 'POST_EXPIRY_LABOR_PROHIBITED');
    
    expect(result.isShadowMode).toBe(true);
    expect(result.effectiveDecision).toBe('ALLOW');
  });

  it('Reason Code Enforced: Returns HARD_BLOCK', async () => {
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([
      { id: 'rule-1', reasonCode: 'POST_EXPIRY_LABOR_PROHIBITED', enforcementLevel: 'HARD_BLOCK', rolloutPercent: 100, priority: 10 }
    ]);
    
    const result = await service.resolve('SUBMIT_TIMESHEET', { supplierId: 's1', transactionDate: new Date() }, 'BLOCK', 'POST_EXPIRY_LABOR_PROHIBITED');
    
    expect(result.isShadowMode).toBe(false);
    expect(result.effectiveDecision).toBe('BLOCK');
  });

  it('Tenant Canary Override: Org override downgrades to SHADOW', async () => {
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([
      // Higher priority wins
      { id: 'rule-org', reasonCode: 'POST_EXPIRY_LABOR_PROHIBITED', organizationId: 'org-1', enforcementLevel: 'SHADOW', rolloutPercent: 100, priority: 20 },
      { id: 'rule-global', reasonCode: 'POST_EXPIRY_LABOR_PROHIBITED', enforcementLevel: 'HARD_BLOCK', rolloutPercent: 100, priority: 10 }
    ]);
    
    const context = { supplierId: 's1', organizationId: 'org-1', transactionDate: new Date() };
    const result = await service.resolve('SUBMIT_TIMESHEET', context, 'BLOCK', 'POST_EXPIRY_LABOR_PROHIBITED');
    
    expect(result.isShadowMode).toBe(true);
    expect(result.effectiveDecision).toBe('ALLOW');
    expect(result.appliedRuleId).toBe('rule-org');
  });

  it('Rollout Percentage: Excluded transactions fallback to SHADOW', async () => {
    // 0% rollout means it will never apply
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([
      { id: 'rule-1', enforcementLevel: 'HARD_BLOCK', rolloutPercent: 0, priority: 10 }
    ]);
    
    const result = await service.resolve('SUBMIT_TIMESHEET', { supplierId: 's1', transactionDate: new Date() }, 'BLOCK');
    
    expect(result.isShadowMode).toBe(true);
    expect(result.effectiveDecision).toBe('ALLOW');
  });
});
