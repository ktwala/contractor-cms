import { computeHcmSourceHash } from './source-hash.util';

describe('computeHcmSourceHash', () => {
  it('is stable regardless of key order', () => {
    const a = { person_id: '1', email: 'a@b.com', nested: { z: 1, a: 2 } };
    const b = { email: 'a@b.com', nested: { a: 2, z: 1 }, person_id: '1' };
    expect(computeHcmSourceHash(a)).toBe(computeHcmSourceHash(b));
  });

  it('changes when payload changes', () => {
    const h1 = computeHcmSourceHash({ person_id: '1', email: 'old@b.com' });
    const h2 = computeHcmSourceHash({ person_id: '1', email: 'new@b.com' });
    expect(h1).not.toBe(h2);
  });
});
