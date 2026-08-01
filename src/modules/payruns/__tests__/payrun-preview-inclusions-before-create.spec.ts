import { PayrunSnapshotService } from '../payrun-snapshot.service';
import { PayRunType } from '../../../common/dto/enums.dto';

describe('PayrunSnapshotService.previewInclusionsBeforeCreate', () => {
  it('delegates period resolution to PayrunsService and returns employment_scope when query is empty', async () => {
    const resolvePayrunPeriodForPreview = jest.fn().mockResolvedValue({
      payGroup: { id: 'pg1', code: 'ZA-MONTHLY', name: 'ZA Monthly', legalEntityId: 'le1' },
      periodId: 'pp1',
      periodStart: new Date('2026-04-01T00:00:00.000Z'),
      periodEnd: new Date('2026-04-30T00:00:00.000Z'),
      payDate: new Date('2026-04-30T00:00:00.000Z'),
    });

    const prisma = {
      employee: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };

    const snapshot = new PayrunSnapshotService(
      prisma as any,
      {} as any,
      { resolvePayrunPeriodForPreview } as any,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );

    const user = { sub: 'u1', legalEntityAccess: ['le1'], permissions: ['payrun:create'] };

    const result = await snapshot.previewInclusionsBeforeCreate(
      {
        pay_group_id: 'pg1',
        period_id: 'pp1',
        run_type: PayRunType.REGULAR,
      },
      user as any,
    );

    expect(resolvePayrunPeriodForPreview).toHaveBeenCalled();
    expect(result.pay_group.code).toBe('ZA-MONTHLY');
    expect(result.candidates).toEqual([]);
    expect(result.excluded).toEqual([]);
    expect(result.employment_scope).toEqual({
      active_employees: 0,
      with_employment_in_pay_group: 0,
      with_employment_overlapping_payrun_period: 0,
    });
    expect(result.run_type).toBe(PayRunType.REGULAR);
  });
});
