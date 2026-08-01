import { describe, expect, it } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const BANNED_PHRASE = 'All eligible employees will be included';

/**
 * Drift guard: Create Payrun must not regress to unqualified "all eligible" copy
 * without a live eligibility preview (counts come from the API, not this string).
 */
describe('Create Payrun copy drift guard', () => {
  it('does not contain the legacy unqualified eligibility promise', () => {
    const file = path.resolve(__dirname, '../CreatePayrun.tsx');
    const content = fs.readFileSync(file, 'utf-8');
    expect(content).not.toContain(BANNED_PHRASE);
  });
});
