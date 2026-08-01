/**
 * PR-TAX-GOV-2C.1 — Lesotho readiness copy must not imply South Africa statutory contribution codes.
 *
 * Run: npm run check:statutory-config-country-copy-drift
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(__dirname, '..');
const LS_COPY = join(REPO, 'admin-portal/src/pages/statutoryReadiness/lsBootstrapReadinessCopy.ts');

function fail(msg: string): never {
  console.error(`[check:statutory-config-country-copy-drift] FAIL: ${msg}`);
  process.exit(1);
}

function main(): void {
  const src = readFileSync(LS_COPY, 'utf8');
  const trio = /\b(UIF|SDL|MTC)\b/i;
  if (trio.test(src)) {
    fail(
      `${LS_COPY}: LS-only copy file must not mention contribution codes UIF, SDL, or MTC. ` +
        'Use zaBootstrapReadinessCopy.ts for ZA-specific language.',
    );
  }
  console.log('[check:statutory-config-country-copy-drift] OK');
}

main();
