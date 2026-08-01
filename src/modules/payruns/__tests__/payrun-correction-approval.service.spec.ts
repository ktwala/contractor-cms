import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { PayrunCorrectionApprovalStatus } from '@prisma/client';
import { PayrunCorrectionApprovalService } from '../payrun-correction-approval.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';

describe('PayrunCorrectionApprovalService (GOV-3D-2-LOCK)', () => {
  let service: PayrunCorrectionApprovalService;
  let prisma: {
    payrunCorrectionApproval: {
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
      count: jest.Mock;
    };
  };
  let audit: { log: jest.Mock };

  beforeEach(async () => {
    prisma = {
      payrunCorrectionApproval: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
    };
    audit = { log: jest.fn().mockResolvedValue(undefined) };
    const moduleRef = await Test.createTestingModule({
      providers: [
        PayrunCorrectionApprovalService,
        { provide: PrismaService, useValue: prisma },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    service = moduleRef.get(PayrunCorrectionApprovalService);
  });

  it('forbids requester approving own correction (SoD)', async () => {
    prisma.payrunCorrectionApproval.findUnique.mockResolvedValue({
      id: 'c1',
      payrunId: 'p1',
      requestedByUserId: 'u1',
      status: PayrunCorrectionApprovalStatus.PENDING,
    });
    await expect(service.approve('c1', 'u1')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('isApprovedCorrectionForSourceMutation is false after adjustment is linked (reuse guard)', async () => {
    prisma.payrunCorrectionApproval.count.mockResolvedValue(0);
    await expect(service.isApprovedCorrectionForSourceMutation('ref-12345678', 'p1')).resolves.toBe(false);
    expect(prisma.payrunCorrectionApproval.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          resultingAdjustmentPayrunId: null,
          status: PayrunCorrectionApprovalStatus.APPROVED,
        }),
      }),
    );
  });

  it('isApprovedCorrectionForSourceMutation is true only for approved pre-link rows', async () => {
    prisma.payrunCorrectionApproval.count.mockResolvedValue(1);
    await expect(service.isApprovedCorrectionForSourceMutation('ref-12345678', 'p1')).resolves.toBe(true);
  });
});
