/**
 * Frontend Permission Drift Test
 *
 * Validates that the generated frontend permission constants stay in sync
 * with the backend canonical catalog. This test should be run as part of
 * the frontend test suite.
 *
 * Invariants enforced:
 * 1. Frontend PERMISSIONS mirrors backend catalog exactly
 * 2. Frontend ALL_PERMISSIONS set matches backend
 * 3. No raw permission strings exist outside permissions.generated.ts
 * 4. Generated file timestamp is present (file was generated, not hand-edited)
 */

import * as fs from 'fs';
import * as path from 'path';

// These imports validate that the generated file compiles and exports correctly
import {
  PERMISSIONS,
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
} from '../permissions.generated';

const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
const BACKEND_CATALOG_PATH = path.join(
  PROJECT_ROOT,
  'backend',
  'src',
  'core',
  'auth',
  'permissions.catalog.json',
);
const FRONTEND_LIB = path.resolve(__dirname, '..');
const GENERATED_FILE = path.join(FRONTEND_LIB, 'permissions.generated.ts');

describe('Frontend Permission Drift Check', () => {
  let backendCatalog: any;

  beforeAll(() => {
    if (fs.existsSync(BACKEND_CATALOG_PATH)) {
      backendCatalog = JSON.parse(
        fs.readFileSync(BACKEND_CATALOG_PATH, 'utf-8'),
      );
    }
  });

  describe('Generated file integrity', () => {
    it('permissions.generated.ts exists', () => {
      expect(fs.existsSync(GENERATED_FILE)).toBe(true);
    });

    it('generated file contains DO NOT EDIT marker', () => {
      const content = fs.readFileSync(GENERATED_FILE, 'utf-8');
      expect(content).toContain('DO NOT EDIT');
    });

    it('generated file contains a timestamp', () => {
      const content = fs.readFileSync(GENERATED_FILE, 'utf-8');
      expect(content).toMatch(/Generated at: \d{4}-\d{2}-\d{2}/);
    });
  });

  describe('Backend ↔ Frontend catalog sync', () => {
    it('backend catalog JSON exists', () => {
      expect(backendCatalog).toBeDefined();
    });

    it('frontend permission count matches backend', () => {
      if (!backendCatalog) return;
      const backendPerms = new Set(backendCatalog.allPermissions);
      expect(ALL_PERMISSIONS.size).toBe(backendPerms.size);
    });

    it('every backend permission exists in frontend', () => {
      if (!backendCatalog) return;
      for (const perm of backendCatalog.allPermissions) {
        expect(ALL_PERMISSIONS.has(perm)).toBe(true);
      }
    });

    it('every frontend permission exists in backend', () => {
      if (!backendCatalog) return;
      const backendPerms = new Set(backendCatalog.allPermissions);
      for (const perm of ALL_PERMISSIONS) {
        expect(backendPerms.has(perm)).toBe(true);
      }
    });

    it('resource group count matches', () => {
      if (!backendCatalog) return;
      expect(PERMISSION_GROUPS.length).toBe(backendCatalog.groups.length);
    });

    it('PERMISSIONS object keys match backend', () => {
      if (!backendCatalog) return;
      const frontendKeys = Object.keys(PERMISSIONS).sort();
      const backendKeys = Object.keys(backendCatalog.permissions).sort();
      expect(frontendKeys).toEqual(backendKeys);
    });
  });

  describe('No raw permission strings in frontend code', () => {
    /**
     * Scan frontend source files for raw permission string patterns
     * (e.g., 'suppliers:create') that should use the PERMISSIONS constant.
     *
     * Exclusions:
     * - permissions.generated.ts (the source itself)
     * - __tests__/ (test files can reference raw strings for assertions)
     * - *.d.ts (type declarations)
     */
    function collectFrontendSourceFiles(dir: string): string[] {
      const results: string[] = [];
      if (!fs.existsSync(dir)) return results;

      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        // Skip test directories, node_modules, .next
        if (
          entry.isDirectory() &&
          ['__tests__', 'node_modules', '.next'].includes(entry.name)
        ) {
          continue;
        }

        if (entry.isDirectory()) {
          results.push(...collectFrontendSourceFiles(fullPath));
        } else if (
          (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) &&
          !entry.name.endsWith('.d.ts') &&
          entry.name !== 'permissions.generated.ts'
        ) {
          results.push(fullPath);
        }
      }
      return results;
    }

    it('no raw permission strings in frontend source files', () => {
      const frontendRoot = path.resolve(__dirname, '..', '..');
      const sourceFiles = collectFrontendSourceFiles(frontendRoot);

      // Pattern: 'resource:action' where resource and action are lowercase
      const rawPermissionPattern = /['"]([a-z][a-z0-9-]*:[a-z][a-z0-9-]*)['"]/g;

      const violations: { file: string; permission: string; line: number }[] = [];

      for (const file of sourceFiles) {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n');

        for (let i = 0; i < lines.length; i++) {
          let match: RegExpExecArray | null;
          while ((match = rawPermissionPattern.exec(lines[i])) !== null) {
            const candidate = match[1];
            // Only flag if it looks like a real permission (exists in catalog)
            if (ALL_PERMISSIONS.has(candidate)) {
              violations.push({
                file: path.relative(frontendRoot, file),
                permission: candidate,
                line: i + 1,
              });
            }
          }
        }
      }

      if (violations.length > 0) {
        const report = violations
          .map((v) => `  ${v.file}:${v.line} → '${v.permission}'`)
          .join('\n');
        throw new Error(
          `Found ${violations.length} raw permission string(s) in frontend code.\n` +
            `Use PERMISSIONS.RESOURCE.ACTION instead:\n${report}`,
        );
      }
    });
  });
});
