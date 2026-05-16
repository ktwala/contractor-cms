import * as fs from 'fs';
import * as path from 'path';
import {
  ALL_PERMISSIONS,
  WILDCARD_ALL,
  PERMISSIONS,
  isValidPermissionFormat,
  isKnownPermission,
} from '../permissions.constants';

/**
 * CI Drift Check: Permission Catalog Integrity
 *
 * These tests run without a database and enforce that:
 * 1. The catalog itself is consistent (no duplicates)
 * 2. Every @Permissions('...') decorator value in controller files exists in the catalog
 * 3. Every seeded role permission exists in the catalog or is a valid wildcard
 * 4. Every domain controller uses @UseGuards(... PermissionsGuard) and @Permissions()
 * 5. Permission strings follow the required format
 */

// ---------------------------------------------------------------------------
// Helpers: extract permission strings from source files via regex
// ---------------------------------------------------------------------------

// Jest rootDir is set to backend/ in jest.unit.config.js
const BACKEND_ROOT = process.cwd();
const DOMAIN_DIR = path.join(BACKEND_ROOT, 'src', 'domain');
const SEED_FILE = path.join(BACKEND_ROOT, 'prisma', 'seed.ts');

/** Recursively collect all .ts files under a directory */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Extract all @Permissions('...') or @Permissions(PERMISSIONS.X.Y) values from a file's contents */
function extractDecoratorPermissions(content: string): string[] {
  const regex = /@Permissions\(\s*(?:'([^']+)'|PERMISSIONS\.([A-Z_]+)\.([A-Z_]+))\s*\)/g;
  const permissions: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    if (match[1]) {
      permissions.push(match[1]); // string literal
    } else {
      // PERMISSIONS.RESOURCE.ACTION -> resource:action
      permissions.push(`${match[2].toLowerCase().replace(/_/g, '-')}:${match[3].toLowerCase()}`);
    }
  }
  return permissions;
}

/** Extract all permission string literals from seed file permission arrays */
function extractSeedPermissions(content: string): string[] {
  // Match strings inside permissions arrays: permissions: ['...', '...']
  const arrayRegex = /permissions:\s*\[([^\]]+)\]/g;
  const stringRegex = /'([^']+)'/g;
  const permissions: string[] = [];
  let arrayMatch: RegExpExecArray | null;

  while ((arrayMatch = arrayRegex.exec(content)) !== null) {
    const arrayContent = arrayMatch[1];
    let stringMatch: RegExpExecArray | null;
    while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
      permissions.push(stringMatch[1]);
    }
  }
  return permissions;
}

/** Check if a controller file has PermissionsGuard applied at class level */
function hasPermissionsGuard(content: string): boolean {
  return (
    content.includes('PermissionsGuard') ||
    content.includes('IntegrationPermissionsGuard')
  );
}

/** Find all controller files in domain directory */
function findControllerFiles(): { file: string; content: string }[] {
  const allFiles = collectTsFiles(DOMAIN_DIR);
  return allFiles
    .filter((f) => f.endsWith('.controller.ts'))
    .map((f) => ({ file: f, content: fs.readFileSync(f, 'utf-8') }));
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Permission Catalog Integrity', () => {
  describe('Catalog consistency', () => {
    it('ALL_PERMISSIONS has no duplicates', () => {
      const flat = Object.values(PERMISSIONS).flatMap((r) =>
        Object.values(r),
      );
      const uniqueSet = new Set(flat);
      expect(flat.length).toBe(uniqueSet.size);
    });

    it('ALL_PERMISSIONS set size matches flat array length', () => {
      const flat = Object.values(PERMISSIONS).flatMap((r) =>
        Object.values(r),
      );
      expect(ALL_PERMISSIONS.size).toBe(flat.length);
    });

    it('every permission in the catalog has a valid format', () => {
      for (const perm of ALL_PERMISSIONS) {
        expect(isValidPermissionFormat(perm)).toBe(true);
      }
    });

    it('WILDCARD_ALL is a valid format', () => {
      expect(isValidPermissionFormat(WILDCARD_ALL)).toBe(true);
    });
  });

  describe('Decorator → Catalog alignment', () => {
    const controllers = findControllerFiles();
    const allDecoratorPermissions: { file: string; permission: string }[] =
      [];

    for (const { file, content } of controllers) {
      const perms = extractDecoratorPermissions(content);
      for (const perm of perms) {
        allDecoratorPermissions.push({
          file: path.relative(BACKEND_ROOT, file),
          permission: perm,
        });
      }
    }

    it('found at least one controller with @Permissions', () => {
      expect(allDecoratorPermissions.length).toBeGreaterThan(0);
    });

    it.each(allDecoratorPermissions)(
      '@Permissions("$permission") in $file exists in the catalog',
      ({ permission }) => {
        expect(ALL_PERMISSIONS.has(permission)).toBe(true);
      },
    );

    it.each(allDecoratorPermissions)(
      '@Permissions("$permission") has valid format',
      ({ permission }) => {
        expect(isValidPermissionFormat(permission)).toBe(true);
      },
    );
  });

  describe('Seed → Catalog alignment', () => {
    let seedPermissions: string[] = [];

    beforeAll(() => {
      if (fs.existsSync(SEED_FILE)) {
        const content = fs.readFileSync(SEED_FILE, 'utf-8');
        seedPermissions = extractSeedPermissions(content);
      }
    });

    it('found seed permissions to validate', () => {
      expect(seedPermissions.length).toBeGreaterThan(0);
    });

    it('every seeded permission exists in the catalog or is a valid wildcard', () => {
      for (const perm of seedPermissions) {
        expect(isKnownPermission(perm)).toBe(true);
      }
    });

    it('every seeded permission has valid format', () => {
      for (const perm of seedPermissions) {
        expect(isValidPermissionFormat(perm)).toBe(true);
      }
    });
  });

  describe('Controller guard coverage', () => {
    const controllers = findControllerFiles();

    it.each(controllers.map((c) => ({ file: path.relative(BACKEND_ROOT, c.file), content: c.content })))(
      '$file has PermissionsGuard applied',
      ({ content }) => {
        expect(hasPermissionsGuard(content)).toBe(true);
      },
    );

    it.each(controllers.map((c) => ({ file: path.relative(BACKEND_ROOT, c.file), content: c.content })))(
      '$file has at least one @Permissions decorator',
      ({ content }) => {
        const perms = extractDecoratorPermissions(content);
        expect(perms.length).toBeGreaterThan(0);
      },
    );
  });

  describe('Handler-level enforcement', () => {
    const controllers = findControllerFiles();

    /**
     * Extract handlers by scanning line-by-line for method signatures
     * (async methodName(...) pattern), then looking upwards through
     * the decorator block for @Permissions or @Public.
     */
    function extractHandlers(
      file: string,
      content: string,
    ): { file: string; method: string; hasPermission: boolean }[] {
      const lines = content.split('\n');
      const results: { file: string; method: string; hasPermission: boolean }[] = [];

      for (let i = 0; i < lines.length; i++) {
        // Match: "  async methodName(" or "  methodName("
        const methodMatch = lines[i].match(/^\s+(?:async\s+)?(\w+)\s*\(/);
        if (!methodMatch) continue;

        const methodName = methodMatch[1];

        // Skip constructor, private methods, class declarations
        if (
          methodName === 'constructor' ||
          methodName === 'class' ||
          methodName === 'return' ||
          methodName === 'if' ||
          methodName === 'for' ||
          methodName === 'while' ||
          methodName === 'switch' ||
          methodName === 'new' ||
          methodName === 'throw' ||
          methodName === 'await' ||
          methodName === 'const' ||
          methodName === 'let' ||
          methodName === 'var' ||
          methodName === 'this'
        ) {
          continue;
        }

        // Look upward (up to 15 lines) for HTTP method decorator
        let hasHttpDecorator = false;
        let hasPermDecorator = false;
        let hasPublicDecorator = false;

        for (let j = i - 1; j >= Math.max(0, i - 15); j--) {
          const decoratorLine = lines[j].trim();

          if (/@(Get|Post|Patch|Put|Delete)\(/.test(decoratorLine)) {
            hasHttpDecorator = true;
          }
          if (/@Permissions\(/.test(decoratorLine)) {
            hasPermDecorator = true;
          }
          if (/@Public\(/.test(decoratorLine)) {
            hasPublicDecorator = true;
          }

          // Stop at empty line or previous method (end of decorator block)
          if (decoratorLine === '' || decoratorLine === '}') {
            break;
          }
        }

        // Only care about methods that have an HTTP decorator
        if (hasHttpDecorator) {
          results.push({
            file: path.relative(BACKEND_ROOT, file),
            method: methodName,
            hasPermission: hasPermDecorator || hasPublicDecorator,
          });
        }
      }

      return results;
    }

    const allHandlers = controllers.flatMap(({ file, content }) =>
      extractHandlers(file, content),
    );

    it('found handler methods to validate', () => {
      expect(allHandlers.length).toBeGreaterThan(0);
    });

    it.each(allHandlers)(
      '$file.$method must have @Permissions or @Public',
      ({ hasPermission }) => {
        expect(hasPermission).toBe(true);
      },
    );
  });

  describe('Cross-layer catalog drift', () => {
    const catalogJsonPath = path.join(
      BACKEND_ROOT,
      'src',
      'core',
      'auth',
      'permissions.catalog.json',
    );

    it('generated catalog JSON exists', () => {
      expect(fs.existsSync(catalogJsonPath)).toBe(true);
    });

    it('generated catalog JSON matches current catalog', () => {
      if (!fs.existsSync(catalogJsonPath)) return;

      const generatedCatalog = JSON.parse(
        fs.readFileSync(catalogJsonPath, 'utf-8'),
      );

      // Compare permission sets (ignore timestamp)
      const generatedPerms = new Set(generatedCatalog.allPermissions);
      expect(generatedPerms.size).toBe(ALL_PERMISSIONS.size);

      for (const perm of ALL_PERMISSIONS) {
        expect(generatedPerms.has(perm)).toBe(true);
      }
    });
  });

  describe('Format validation', () => {
    it('rejects malformed permission strings', () => {
      expect(isValidPermissionFormat('nocolon')).toBe(false);
      expect(isValidPermissionFormat('')).toBe(false);
      expect(isValidPermissionFormat(':')).toBe(false);
      expect(isValidPermissionFormat(':action')).toBe(false);
      expect(isValidPermissionFormat('resource:')).toBe(false);
      expect(isValidPermissionFormat('123:action')).toBe(false);
    });

    it('accepts valid permission strings', () => {
      expect(isValidPermissionFormat('suppliers:create')).toBe(true);
      expect(isValidPermissionFormat('tax-classifications:approve')).toBe(
        true,
      );
      expect(isValidPermissionFormat('*:*')).toBe(true);
      expect(isValidPermissionFormat('suppliers:*')).toBe(true);
    });
  });
});

