import { getRiskLevel } from '../audit-risk.constants';

describe('Audit Risk Constants', () => {
  describe('getRiskLevel', () => {
    it('returns deterministic risk level for known actions', () => {
      expect(getRiskLevel('CMS_ADMIN_ASSIGNED')).toBe('critical');
      expect(getRiskLevel('ROLE_DELETED')).toBe('high');
      expect(getRiskLevel('USER_ROLE_ASSIGNED')).toBe('medium');
    });

    it('returns low as default for unknown actions', () => {
      expect(getRiskLevel('SOME_UNKNOWN_ACTION')).toBe('low');
      expect(getRiskLevel('')).toBe('low');
      expect(getRiskLevel(undefined as unknown as string)).toBe('low');
    });
  });
});
