import { PdpActivationAdminService } from './pdp.activation.admin.service';
import { PrismaService } from '../core/database/prisma.service';
import { PdpEngine } from './pdp.engine';
import { BadRequestException } from '@nestjs/common';
import { CreateActivationRuleDto } from './dto/create-activation-rule.dto';

const mockPrisma = {
  pdpActivationRule: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
} as unknown as PrismaService;

const mockEngine = {
  evaluate: jest.fn(),
} as unknown as PdpEngine;

describe('PDP Activation Admin Service - Safety Guardrails', () => {
  let service: PdpActivationAdminService;

  beforeEach(() => {
    service = new PdpActivationAdminService(mockPrisma, mockEngine);
    jest.clearAllMocks();
  });

  const validDto: CreateActivationRuleDto = {
    enforcementLevel: 'WARN',
    reasonCode: 'POST_EXPIRY_LABOR_PROHIBITED',
    action: 'SUBMIT_TIMESHEET',
  };

  it('rejects rolloutPercent outside 0-100', async () => {
    const dto = { ...validDto, rolloutPercent: 105 };
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow('between 0 and 100');
  });

  it('rejects HARD_BLOCK in production without explicit approvedBy', async () => {
    const dto = { ...validDto, environment: 'production', enforcementLevel: 'HARD_BLOCK' };
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow('requires an explicit approvedBy');
  });

  it('allows HARD_BLOCK in production WITH explicit approvedBy', async () => {
    const dto = { 
      ...validDto, 
      environment: 'production', 
      enforcementLevel: 'HARD_BLOCK', 
      approvedBy: 'CFO_JOHN',
      expiresAt: '2026-12-31' // also requires expiry if global
    };
    
    (mockPrisma.pdpActivationRule.create as jest.Mock).mockResolvedValue({ id: 'rule-1', ...dto });
    const result = await service.createRule(dto, 'admin-1');
    
    expect(result.id).toBe('rule-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects global HARD_BLOCK without expiresAt', async () => {
    const dto = { 
      ...validDto, 
      enforcementLevel: 'HARD_BLOCK', 
      approvedBy: 'CEO_JANE',
      // No organizationId, no domain = Global
    };
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow(BadRequestException);
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow('Global HARD_BLOCK requires an expiresAt');
  });

  it('rejects invalid reasonCode and actions', async () => {
    const dto = { ...validDto, action: 'DELETE_DATABASE' };
    await expect(service.createRule(dto, 'admin-1')).rejects.toThrow('Invalid action');
  });

  it('emits accurate audit log on rule disable', async () => {
    const beforeRule = { id: 'rule-1', isActive: true, enforcementLevel: 'HARD_BLOCK' };
    (mockPrisma.pdpActivationRule.findUnique as jest.Mock).mockResolvedValue(beforeRule);
    (mockPrisma.pdpActivationRule.update as jest.Mock).mockResolvedValue({ ...beforeRule, isActive: false });

    await service.disableRule('rule-1', 'admin-user', 'Too much noise');

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'PDP_ACTIVATION_CHANGE',
        targetType: 'PdpActivationRule',
        targetId: 'rule-1',
        metadata: {
          actorId: 'admin-user',
          reason: 'Too much noise',
          changes: {
            before: beforeRule,
            after: { ...beforeRule, isActive: false }
          }
        }
      })
    }));
  });
});
