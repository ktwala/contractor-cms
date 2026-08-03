import { describe, expect, it } from 'vitest';
import createPayrunSource from '../CreatePayrun.tsx?raw';

const BANNED_PHRASE = 'All eligible employees will be included';

/**
 * Drift guard: Create Payrun must not regress to unqualified "all eligible" copy
 * without a live eligibility preview (counts come from the API, not this string).
 */
describe('Create Payrun copy drift guard', () => {
  it('does not contain the legacy unqualified eligibility promise', () => {
    expect(createPayrunSource).not.toContain(BANNED_PHRASE);
  });
});
