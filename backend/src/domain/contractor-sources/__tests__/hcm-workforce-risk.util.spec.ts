import {
  isUpstreamWorkforceTerminated,
} from '../utils/hcm-workforce-risk.util';

describe('hcm-workforce-risk.util (PR-CTR-CONNECTOR-1E)', () => {
  it('detects terminated assignment status', () => {
    expect(
      isUpstreamWorkforceTerminated({ assignmentStatus: 'terminated' }),
    ).toBe(true);
    expect(isUpstreamWorkforceTerminated({ assignmentStatus: 'active' })).toBe(false);
  });

  it('detects past end date as terminated upstream', () => {
    expect(
      isUpstreamWorkforceTerminated({ endDate: '2020-01-01', assignmentStatus: 'active' }),
    ).toBe(true);
  });
});
