import { PrismaService } from '../core/database/prisma.service';
import { PrismaClient } from '@prisma/client';
import { PdpEngine } from './pdp.engine';
import { PdpContext } from './pdp.types';
import { PdpReasonCode } from './pdp.reason-codes';

// Basic Prisma Mock
const mockPrisma = {
  supplier: { findUnique: jest.fn() },
  contractor: { findUnique: jest.fn() },
  contractorEngagement: { findMany: jest.fn() },
  contractorGovernanceRemediation: { findFirst: jest.fn().mockResolvedValue(null) },
} as unknown as PrismaClient;

describe('PDP Core Engine v1.1 - Live Data Shadow Evaluation', () => {
  let engine: PdpEngine;

  const mockActivationService = {
    resolve: jest.fn().mockResolvedValue({ effectiveDecision: 'ALLOW', isShadowMode: true })
  } as any;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-05-15T12:00:00.000Z'));
    engine = new PdpEngine(mockPrisma as unknown as PrismaService, mockActivationService);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('Test Case 1: Valid transaction → evaluated ALLOW', async () => {
    (mockPrisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      status: 'ACTIVE',
      organization: { supplierAuthorityMode: 'ORACLE_ONLY' },
      sourceSystem: 'ORACLE_SUPPLIER_SAAS',
      externalSupplierId: 'oracle-1',
      sourceSyncStatus: 'SYNCED',
      documents: []
    });
    (mockPrisma.contractor.findUnique as jest.Mock).mockResolvedValue({ isActive: true, accessExpiresAt: new Date('2099-01-01') });
    (mockPrisma.contractorEngagement.findMany as jest.Mock).mockResolvedValue([
      { contract: { endDate: new Date('2099-01-01') } }
    ]);

    const context: PdpContext = {
      supplierId: 'sup-1',
      contractorId: 'con-1',
      transactionDate: new Date('2026-05-01'),
    };

    const result = await engine.evaluate('SUBMIT_TIMESHEET', context);
    expect(result.evaluatedDecision).toBe('ALLOW');
    expect(result.effectiveDecision).toBe('ALLOW');
  });

  it('Test Case 2: Expired supplier → evaluated HOLD', async () => {
    (mockPrisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      status: 'SUSPENDED',
      organization: { supplierAuthorityMode: 'ORACLE_ONLY' },
      sourceSystem: 'ORACLE_SUPPLIER_SAAS',
      externalSupplierId: 'oracle-1',
      sourceSyncStatus: 'SYNCED',
      documents: []
    });

    const context: PdpContext = {
      supplierId: 'sup-1',
      transactionDate: new Date('2026-05-01'),
    };

    const result = await engine.evaluate('SUBMIT_TIMESHEET', context);
    expect(result.evaluatedDecision).toBe('HOLD');
    expect(result.reason_code).toBe(PdpReasonCode.SUPPLIER_MASTER_EXPIRED);
  });

  it('Test Case 3: Missing PO on Invoice → evaluated BLOCK', async () => {
    (mockPrisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      status: 'ACTIVE',
      organization: { supplierAuthorityMode: 'ORACLE_ONLY' },
      sourceSystem: 'ORACLE_SUPPLIER_SAAS',
      externalSupplierId: 'oracle-1',
      sourceSyncStatus: 'SYNCED',
      documents: []
    });
    (mockPrisma.contractor.findUnique as jest.Mock).mockResolvedValue({ isActive: true });
    (mockPrisma.contractorEngagement.findMany as jest.Mock).mockResolvedValue([]);

    const context: PdpContext = {
      supplierId: 'sup-1',
      transactionDate: new Date('2026-05-01'),
      // poId is missing intentionally
    };

    const result = await engine.evaluate('SUBMIT_INVOICE', context);
    expect(result.evaluatedDecision).toBe('BLOCK');
    expect(result.reason_code).toBe(PdpReasonCode.PO_MISSING);
    expect(result.effectiveDecision).toBe('ALLOW'); // Shadow mode protects the block
  });

  it('Test Case 4: Late pre-expiry timesheet → evaluated APPROVAL_REQUIRED', async () => {
    (mockPrisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      status: 'ACTIVE',
      organization: { supplierAuthorityMode: 'ORACLE_ONLY' },
      sourceSystem: 'ORACLE_SUPPLIER_SAAS',
      externalSupplierId: 'oracle-1',
      sourceSyncStatus: 'SYNCED',
      documents: []
    });
    (mockPrisma.contractor.findUnique as jest.Mock).mockResolvedValue({ isActive: true });
    (mockPrisma.contractorEngagement.findMany as jest.Mock).mockResolvedValue([
      { contract: { endDate: new Date('2099-01-01') } }
    ]);

    // Transaction date is 60 days ago
    const msIn60Days = 60 * 24 * 60 * 60 * 1000;
    const oldDate = new Date(Date.now() - msIn60Days);

    const context: PdpContext = {
      supplierId: 'sup-1',
      contractorId: 'con-1',
      transactionDate: oldDate,
    };

    const result = await engine.evaluate('SUBMIT_TIMESHEET', context);
    expect(result.evaluatedDecision).toBe('APPROVAL_REQUIRED');
    expect(result.reason_code).toBe(PdpReasonCode.TIMESHEET_LATE_SUBMISSION);
  });

  it('Test Case 5: Post-expiry labor → evaluated BLOCK', async () => {
    (mockPrisma.supplier.findUnique as jest.Mock).mockResolvedValue({
      status: 'ACTIVE',
      organization: { supplierAuthorityMode: 'ORACLE_ONLY' },
      sourceSystem: 'ORACLE_SUPPLIER_SAAS',
      externalSupplierId: 'oracle-1',
      sourceSyncStatus: 'SYNCED',
      documents: []
    });
    (mockPrisma.contractor.findUnique as jest.Mock).mockResolvedValue({ isActive: true });
    
    // Contract ended last year
    (mockPrisma.contractorEngagement.findMany as jest.Mock).mockResolvedValue([
      { contract: { endDate: new Date('2025-01-01') } }
    ]);

    const context: PdpContext = {
      supplierId: 'sup-1',
      contractorId: 'con-1',
      transactionDate: new Date('2026-05-01'),
    };

    const result = await engine.evaluate('SUBMIT_TIMESHEET', context);
    expect(result.evaluatedDecision).toBe('BLOCK');
    expect(result.reason_code).toBe(PdpReasonCode.POST_EXPIRY_LABOR_PROHIBITED);
  });
});
