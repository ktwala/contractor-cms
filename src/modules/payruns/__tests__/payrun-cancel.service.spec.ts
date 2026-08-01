import { ConflictException } from '@nestjs/common';
import { PayRunStatus } from '../../../common/dto/enums.dto';
import { PayrunLifecycleService } from '../payrun-lifecycle.service';

describe('PayrunLifecycleService.cancelPayrun', () => {
  const user = { sub: 'u1' };

  function make(opts?: { batch?: { id: string; status: string; exportStatus: string } | null; payrunStatus?: string }) {
    const batch = opts?.batch;
    const payrunStatus = opts?.payrunStatus ?? 'DRAFT';
    const payrunsService = {
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ status: payrunStatus, notes: '', id: 'p1' })
        .mockResolvedValueOnce({ status: 'CANCELLED', id: 'p1' }),
    };
    const prisma = {
      paymentBatch: { findFirst: jest.fn().mockResolvedValue(batch ?? null) },
      payRun: { update: jest.fn().mockResolvedValue({}) },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const svc = new PayrunLifecycleService(
      prisma as any,
      audit as any,
      payrunsService as any,
      {} as any,
      {} as any,
      undefined,
    );
    return { svc, prisma, audit };
  }

  it('sets CANCELLED and audits PAYRUN_CANCELLED from DRAFT', async () => {
    const { svc, prisma, audit } = make();
    await svc.cancelPayrun('p1', 'Abandon duplicate run', user as any, undefined);
    expect(prisma.paymentBatch.findFirst).toHaveBeenCalled();
    expect(prisma.payRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: PayRunStatus.CANCELLED }),
      }),
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'PAYRUN_CANCELLED', entityId: 'p1' }),
    );
  });

  it('throws PAYRUN_CANCEL_BLOCKED_PAYMENT_BATCH when a non-void batch exists', async () => {
    const { svc } = make({
      batch: { id: 'b1', status: 'PENDING', exportStatus: 'NOT_GENERATED' },
    });
    await expect(svc.cancelPayrun('p1', 'x', user as any)).rejects.toThrow(/Cannot cancel/);
  });

  it('throws when export was generated even if batch status is cancelled', async () => {
    const { svc } = make({
      batch: { id: 'b1', status: 'CANCELLED', exportStatus: 'GENERATED' },
    });
    await expect(svc.cancelPayrun('p1', 'x', user as any)).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws when status is APPROVED', async () => {
    const { svc } = make({ payrunStatus: 'APPROVED' });
    await expect(svc.cancelPayrun('p1', 'x', user as any)).rejects.toBeInstanceOf(ConflictException);
  });
});
