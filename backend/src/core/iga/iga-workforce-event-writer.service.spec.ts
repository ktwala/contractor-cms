import { shouldEmitSponsorAssignedEvent } from './iga-workforce-event-writer.service';

describe('shouldEmitSponsorAssignedEvent', () => {
  it('emits when sponsor is newly assigned', () => {
    expect(shouldEmitSponsorAssignedEvent(null, 'hcm:1')).toBe(true);
  });

  it('emits when primary sponsor id changes', () => {
    expect(shouldEmitSponsorAssignedEvent('hcm:1', 'hcm:2')).toBe(true);
  });

  it('does not emit when sponsor cleared', () => {
    expect(shouldEmitSponsorAssignedEvent('hcm:1', null)).toBe(false);
  });

  it('does not emit when sponsor unchanged', () => {
    expect(shouldEmitSponsorAssignedEvent('hcm:1', 'hcm:1')).toBe(false);
  });
});
