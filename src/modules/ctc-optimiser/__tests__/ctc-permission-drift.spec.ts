import * as fs from 'fs';
import * as path from 'path';

/**
 * CI drift guardrails — detect banned permission variants that would
 * bypass the canonical constants. Run in CI to block PRs that introduce drift.
 */
describe('CTC Optimiser Permission Drift Guardrails', () => {
  const BANNED_VARIANTS = [
    'payroll.ctcOptimiser.',
    'payroll:ctcOptimiser:',
    'compensation.ctc_optimiser.',
    'compensation:ctc_optimiser:',
    'payroll.ctc_optimiser.',
    'admin.ctc_optimiser',
    'global.ctc_optimiser',
    'soc.ctc_optimiser',
  ];

  const SRC_DIRS = [
    path.resolve(__dirname, '../../..'),
    path.resolve(__dirname, '../../../../admin-portal/src'),
  ];

  function collectTsFiles(dir: string): string[] {
    const files: string[] = [];
    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === '.next') continue;
      if (entry.isDirectory()) {
        files.push(...collectTsFiles(full));
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        files.push(full);
      }
    }
    return files;
  }

  for (const srcDir of SRC_DIRS) {
    const label = srcDir.includes('admin-portal') ? 'frontend' : 'backend';

    describe(`${label} source tree`, () => {
      it('contains no banned CTC permission variants', () => {
        const files = collectTsFiles(srcDir);
        const violations: string[] = [];

        for (const file of files) {
          if (file.includes('ctc-permission-drift.spec') || file.includes('ctc-permission-registry.spec')) continue;
          const content = fs.readFileSync(file, 'utf-8');
          for (const banned of BANNED_VARIANTS) {
            if (content.includes(banned)) {
              violations.push(`${path.relative(srcDir, file)} contains "${banned}"`);
            }
          }
        }

        expect(violations).toEqual([]);
      });

      it('no inline CTC permission strings bypass constants (spot-check)', () => {
        const files = collectTsFiles(srcDir);
        const violations: string[] = [];

        for (const file of files) {
          if (
            file.includes('permissions.ts') ||
            file.includes('permission-drift.spec') ||
            file.includes('permission-registry.spec') ||
            file.includes('AdminLayout.tsx')
          ) {
            continue;
          }

          const content = fs.readFileSync(file, 'utf-8');
          const matches = content.match(/['"]payroll:ctc_optimiser:\w+['"]/g);
          if (matches && matches.length > 0) {
            violations.push(
              `${path.relative(srcDir, file)}: inline permission string(s) found: ${matches.join(', ')}. Use P.CTC_OPTIMISER_* constants instead.`,
            );
          }
        }

        expect(violations).toEqual([]);
      });
    });
  }
});
