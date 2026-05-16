import { PdpTelemetryService } from './pdp.telemetry.service';
import { PrismaService } from '../core/database/prisma.service';

const mockPrisma = {
  auditLog: {
    findMany: jest.fn(),
  },
} as unknown as PrismaService;

describe('PdpTelemetryService', () => {
  let service: PdpTelemetryService;

  beforeEach(() => {
    service = new PdpTelemetryService(mockPrisma);
    jest.clearAllMocks();
  });

  it('calculates telemetry aggregates correctly', async () => {
    // Mock the DB returning shadow events
    (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([
      { metadata: { evaluatedDecision: 'BLOCK', reason_code: 'PO_MISSING' } },
      { metadata: { evaluatedDecision: 'BLOCK', reason_code: 'PO_MISSING' } },
      { metadata: { evaluatedDecision: 'BLOCK', reason_code: 'CONTRACTOR_OFFBOARDED' } },
      { metadata: { evaluatedDecision: 'HOLD', reason_code: 'SUPPLIER_MASTER_EXPIRED' } },
      { metadata: { evaluatedDecision: 'APPROVAL_REQUIRED', reason_code: 'TIMESHEET_LATE_SUBMISSION' } },
    ]);

    const result = await service.getTelemetry(30);

    expect(result.totalEvaluations).toBe(5);
    expect(result.shadowBlocks).toBe(3);
    expect(result.shadowHolds).toBe(1);
    expect(result.approvalRequired).toBe(1);

    // Verify sorting of top reason codes
    expect(result.topReasonCodes[0].reason_code).toBe('PO_MISSING');
    expect(result.topReasonCodes[0].count).toBe(2);
    expect(result.topReasonCodes[1].count).toBe(1);
    
    // Total distinct reason codes
    expect(result.topReasonCodes.length).toBe(4);
  });

  it('handles empty states gracefully', async () => {
    (mockPrisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);

    const result = await service.getTelemetry(30);

    expect(result.totalEvaluations).toBe(0);
    expect(result.shadowBlocks).toBe(0);
    expect(result.topReasonCodes).toEqual([]);
  });
});
