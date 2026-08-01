import { AUDIT_EVENTS, AUDIT_SEVERITY } from '../audit-events.constants';
import * as fs from 'fs';
import * as path from 'path';

describe('Audit Intelligence Contract Drift', () => {
  it('should map all canonical events to valid severity levels', () => {
    const validSeverities = Object.values(AUDIT_SEVERITY);
    for (const [key, def] of Object.entries(AUDIT_EVENTS)) {
      expect(validSeverities).toContain(def.defaultSeverity);
      expect(def.action).toBe(key);
    }
  });

  it('should classify sensitive role and user mutations with WARNING or CRITICAL severity', () => {
    const highRiskMutations = [
      'ROLE_UPDATED',
      'ROLE_DELETED',
      'ROLE_ASSIGNED',
      'ROLE_REMOVED',
      'USER_ROLES_REPLACED',
      'USER_DEACTIVATED',
    ];

    highRiskMutations.forEach((mutation) => {
      const def = AUDIT_EVENTS[mutation as keyof typeof AUDIT_EVENTS];
      expect(def).toBeDefined();
      expect([AUDIT_SEVERITY.WARNING, AUDIT_SEVERITY.CRITICAL]).toContain(
        def.defaultSeverity,
      );
    });
  });

  it('should properly tag spoofing and anomaly events with CRITICAL severity', () => {
    const spoofEvent = AUDIT_EVENTS.VALIDATION_SPOOF_400;
    expect(spoofEvent).toBeDefined();
    expect(spoofEvent.defaultSeverity).toBe(AUDIT_SEVERITY.CRITICAL);
  });

  it('should not contain arbitrary audit events in service files outside of canonical definitions', () => {
    // This is essentially doing what audit-catalog-check.ts does, ensuring safety in CI tests
    const domainDir = path.join(__dirname, '../../../../src/domain');
    const walkSync = (dir: string, filelist: string[] = []) => {
      const files = fs.readdirSync(dir);
      files.forEach((file) => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
          filelist = walkSync(filepath, filelist);
        } else if (file.endsWith('.service.ts') || file.endsWith('.controller.ts')) {
          filelist.push(filepath);
        }
      });
      return filelist;
    };

    const files = walkSync(domainDir);
    const validEvents = Object.keys(AUDIT_EVENTS);

    files.forEach((file) => {
      const content = fs.readFileSync(file, 'utf8');
      let pos = 0;
      while ((pos = content.indexOf('logAction(', pos)) !== -1) {
        let braceCount = 1;
        let endPos = pos + 'logAction('.length;
        while (braceCount > 0 && endPos < content.length) {
          if (content[endPos] === '(') braceCount++;
          else if (content[endPos] === ')') braceCount--;
          endPos++;
        }
        const argsStr = content.slice(pos + 'logAction('.length, endPos - 1);
        pos = endPos; // advance

        // Parse argsStr by commas at depth 0
        const args: string[] = [];
        let currentArg = '';
        let depth = 0;
        let inQuote = false;
        let quoteChar = '';
        for (let i = 0; i < argsStr.length; i++) {
          const char = argsStr[i];
          if (inQuote) {
            if (char === quoteChar && argsStr[i - 1] !== '\\') {
              inQuote = false;
            }
            currentArg += char;
          } else {
            if (char === "'" || char === '"' || char === '`') {
              inQuote = true;
              quoteChar = char;
              currentArg += char;
            } else if (char === '(' || char === '{' || char === '[') {
              depth++;
              currentArg += char;
            } else if (char === ')' || char === '}' || char === ']') {
              depth--;
              currentArg += char;
            } else if (char === ',' && depth === 0) {
              args.push(currentArg.trim());
              currentArg = '';
            } else {
              currentArg += char;
            }
          }
        }
        if (currentArg.trim()) {
          args.push(currentArg.trim());
        }

        if (args.length >= 2) {
          const actionArg = args[1];
          // Check if it is a string literal
          const literalMatch = actionArg.match(/^['"`]([A-Z_0-9]+)['"`]$/);
          if (literalMatch) {
            expect(validEvents).toContain(literalMatch[1]);
          }
        }
      }
    });
  });
});
