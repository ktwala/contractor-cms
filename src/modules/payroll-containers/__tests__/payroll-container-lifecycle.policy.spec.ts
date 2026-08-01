import {
  collectArchiveBlockers,
  collectCloseBlockers,
} from '../payroll-container-lifecycle.policy';

describe('payroll-container-lifecycle.policy', () => {
  it('collectCloseBlockers returns blocker when in-flight payruns exist', () => {
    expect(collectCloseBlockers(2)).toHaveLength(1);
    expect(collectCloseBlockers(2)[0].code).toBe('PAYROLL_CLOSE_ACTIVE_PAYRUNS');
    expect(collectCloseBlockers(0)).toHaveLength(0);
  });

  it('collectArchiveBlockers stacks closed periods, active payruns, and activity payruns', () => {
    const b = collectArchiveBlockers({
      periodsClosedCount: 1,
      activePayrunCount: 0,
      activityPayrunCount: 0,
    });
    expect(b.map((x) => x.code)).toContain('PAYROLL_ARCHIVE_CLOSED_PERIODS');

    const b2 = collectArchiveBlockers({
      periodsClosedCount: 0,
      activePayrunCount: 3,
      activityPayrunCount: 0,
    });
    expect(b2.map((x) => x.code)).toContain('PAYROLL_ARCHIVE_ACTIVE_PAYRUNS');

    const b3 = collectArchiveBlockers({
      periodsClosedCount: 0,
      activePayrunCount: 0,
      activityPayrunCount: 2,
    });
    expect(b3.map((x) => x.code)).toContain('PAYROLL_ARCHIVE_PAYROLL_ACTIVITY');
  });

  it('collectArchiveBlockers returns empty when all counts zero', () => {
    expect(
      collectArchiveBlockers({
        periodsClosedCount: 0,
        activePayrunCount: 0,
        activityPayrunCount: 0,
      }),
    ).toHaveLength(0);
  });
});
