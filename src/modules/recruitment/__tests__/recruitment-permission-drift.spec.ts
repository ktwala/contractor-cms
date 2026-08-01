import * as fs from 'fs';
import * as path from 'path';

/**
 * CI drift guardrails — detect banned recruitment permission variants that
 * would bypass the canonical constants. Mirrors the CTC Optimiser drift pattern.
 */
describe('Recruitment Permission Drift Guardrails', () => {
  const BANNED_VARIANTS = [
    'recruitment.requisitions.',
    'recruitment.candidates.',
    'recruitment.applications.',
    'recruitment.interviews.',
    'recruitment.offers.',
    'recruitment.onboarding.',
    'talent:requisitions:',
    'talent:candidates:',
    'talent:interviews:',
    'talent:offers:',
    'talent:onboarding:',
    'hr:recruitment:',
    'hiring:',
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
      it('contains no banned recruitment permission variants', () => {
        const files = collectTsFiles(srcDir);
        const violations: string[] = [];

        for (const file of files) {
          if (
            file.includes('recruitment-permission-drift.spec') ||
            file.includes('recruitment-permission-registry.spec')
          ) continue;

          const content = fs.readFileSync(file, 'utf-8');
          for (const banned of BANNED_VARIANTS) {
            if (content.includes(banned)) {
              violations.push(`${path.relative(srcDir, file)} contains "${banned}"`);
            }
          }
        }

        expect(violations).toEqual([]);
      });

      it('no inline recruitment permission strings bypass constants', () => {
        const files = collectTsFiles(srcDir);
        const violations: string[] = [];

        for (const file of files) {
          if (
            file.includes('permissions.ts') ||
            file.includes('permission-drift.spec') ||
            file.includes('permission-registry.spec') ||
            file.includes('AdminLayout.tsx') ||
            file.includes('recruitmentSurfaceRegistry.ts') ||
            file.includes('seed.ts')
          ) {
            continue;
          }

          const content = fs.readFileSync(file, 'utf-8');
          const matches = content.match(/['"]recruitment:[a-z_]+:[a-z_]+['"]/g);
          if (matches && matches.length > 0) {
            violations.push(
              `${path.relative(srcDir, file)}: inline permission string(s) found: ${matches.join(', ')}. Use P.RECRUITMENT_* constants instead.`,
            );
          }
        }

        expect(violations).toEqual([]);
      });
    });
  }
});
