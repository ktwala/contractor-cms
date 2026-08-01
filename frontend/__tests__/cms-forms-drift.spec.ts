import fs from 'fs';
import path from 'path';
import {
  currencyDisplayWouldShowNan,
  formatAmountForCsvExport,
  formatCurrencyDisplay,
} from '@/lib/display-format';
import { mapContractsForCsvExport } from '@/lib/csv-export';

const FRONTEND_ROOT = path.resolve(__dirname, '..');
const FRONTEND_APP = path.join(FRONTEND_ROOT, 'app');

const FORBIDDEN_SNIPPETS = [
  'Supplier form would go here',
  'Use react-hook-form for full implementation',
];

function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectSourceFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

describe('CMS forms drift guards (PR-CMS-FORMS-1A)', () => {
  it('has no supplier modal placeholder copy under frontend/app', () => {
    const hits: string[] = [];
    for (const file of collectSourceFiles(FRONTEND_APP)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const snippet of FORBIDDEN_SNIPPETS) {
        if (content.includes(snippet)) {
          hits.push(`${path.relative(FRONTEND_ROOT, file)} contains "${snippet}"`);
        }
      }
    }
    expect(hits).toEqual([]);
  });

  it('never renders RNaN from formatCurrencyDisplay', () => {
    const samples: Array<[number | null | undefined, string | undefined]> = [
      [null, 'ZAR'],
      [undefined, 'ZAR'],
      [NaN, 'ZAR'],
      [Number('not-a-number'), 'ZAR'],
    ];
    for (const [amount, currency] of samples) {
      expect(formatCurrencyDisplay(amount, currency)).not.toMatch(/NaN/);
      expect(currencyDisplayWouldShowNan(amount, currency)).toBe(false);
    }
  });

  it('exports contract rates without NaN strings', () => {
    const rows = mapContractsForCsvExport([
      { contractNumber: 'C-1', title: 'T', type: null, rate: NaN, rateType: 'HOURLY' },
      { contractNumber: 'C-2', title: 'T', type: 'unknown', rate: null, rateType: 'HOURLY' },
    ]);
    expect(rows[0].rate).toBe('');
    expect(rows[0].type).toBe('Not classified');
    expect(rows[1].rate).toBe('');
    expect(rows[1].type).toBe('Not classified');
    expect(formatAmountForCsvExport(NaN)).toBe('');
    for (const row of rows) {
      expect(String(row.rate)).not.toMatch(/NaN/i);
    }
  });
});
