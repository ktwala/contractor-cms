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
      const matches = content.match(/logAction\([^)]*\)/g);
      
      if (matches) {
        matches.forEach((match) => {
          // Extract the string literal used for the action name (2nd argument)
          // Simplified regex to catch 'EVENT_NAME' or "EVENT_NAME"
          const actionMatch = match.match(/['"]([A-Z_0-9]+)['"]/);
          if (actionMatch && actionMatch[1]) {
            const actionString = actionMatch[1];
            // If it's a known non-event literal, skip it (like targetType 'User')
            // This is a naive check. A better approach is AST parsing or just checking the validEvents set.
            if (actionString === actionString.toUpperCase() && !actionString.includes(' ')) {
              expect(validEvents).toContain(actionString);
            }
          }
        });
      }
    });
  });
});
