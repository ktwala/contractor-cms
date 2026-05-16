import { PdpExceptionService } from './pdp.exception.service';
import { PrismaService } from '../core/database/prisma.service';
import { PdpActivationService } from './pdp.activation.service';
import { BadRequestException } from '@nestjs/common';
import { CreateExceptionDto } from './dto/create-exception.dto';
import { ApproveExceptionDto } from './dto/approve-exception.dto';

const mockPrisma = {
  pdpExceptionRequest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  pdpActivationRule: {
    findMany: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
} as unknown as PrismaService;

const mockActivationService = {} as unknown as PdpActivationService;

describe('PDP Exception Service', () => {
  let service: PdpExceptionService;

  beforeEach(() => {
    service = new PdpExceptionService(mockPrisma, mockActivationService);
    jest.clearAllMocks();
  });

  const createDto: CreateExceptionDto = {
    evaluationId: 'eval-123',
    reasonCode: 'MISSING_PO',
    action: 'SUBMIT_INVOICE',
    justification: 'Emergency invoice',
  };

  it('allows creating exception if not HARD_BLOCK', async () => {
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([
      { enforcementLevel: 'APPROVAL_REQUIRED' }
    ]);
    (mockPrisma.pdpExceptionRequest.create as jest.Mock).mockResolvedValue({ id: 'ex-1' });

    const result = await service.createException(createDto, 'user-1');
    expect(result.id).toBe('ex-1');
    expect(mockPrisma.auditLog.create).toHaveBeenCalled();
  });

  it('rejects creating exception if HARD_BLOCK', async () => {
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([
      { enforcementLevel: 'HARD_BLOCK' } // Highest priority rule says hard block
    ]);

    await expect(service.createException(createDto, 'user-1')).rejects.toThrow(BadRequestException);
    await expect(service.createException(createDto, 'user-1')).rejects.toThrow('HARD_BLOCK policies are strictly non-overridable');
  });

  it('rejects approval if not PENDING', async () => {
    (mockPrisma.pdpExceptionRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'ex-1',
      status: 'APPROVED', // Not pending
      requestedBy: 'user-1'
    });

    const approveDto: ApproveExceptionDto = { expiresAt: new Date().toISOString() };
    await expect(service.approveException('ex-1', approveDto, 'manager-1')).rejects.toThrow('Only PENDING exceptions can be approved');
  });

  it('rejects self-approval (segregation of duties)', async () => {
    (mockPrisma.pdpExceptionRequest.findUnique as jest.Mock).mockResolvedValue({
      id: 'ex-1',
      status: 'PENDING',
      requestedBy: 'user-1' // Requestor is user-1
    });

    const approveDto: ApproveExceptionDto = { expiresAt: new Date().toISOString() };
    await expect(service.approveException('ex-1', approveDto, 'user-1')).rejects.toThrow('Segregation of duties: You cannot approve your own exception request.');
  });

  it('approves successfully and emits audit', async () => {
    const beforeEx = { id: 'ex-1', status: 'PENDING', requestedBy: 'user-1', reasonCode: 'MISSING_PO' };
    (mockPrisma.pdpExceptionRequest.findUnique as jest.Mock).mockResolvedValue(beforeEx);
    (mockPrisma.pdpActivationRule.findMany as jest.Mock).mockResolvedValue([]);
    
    (mockPrisma.pdpExceptionRequest.update as jest.Mock).mockResolvedValue({
      ...beforeEx,
      status: 'APPROVED'
    });

    const approveDto: ApproveExceptionDto = { expiresAt: new Date().toISOString(), approvalNotes: 'Looks fine' };
    const result = await service.approveException('ex-1', approveDto, 'manager-1');
    
    expect(result.status).toBe('APPROVED');
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'PDP_EXCEPTION_CHANGE',
        tags: ['PDP', 'EXCEPTION', 'APPROVE']
      })
    }));
  });
});
