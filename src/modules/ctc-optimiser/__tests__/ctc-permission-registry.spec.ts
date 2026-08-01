import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { P as BackendP, CTC_OPTIMISER_ALL } from '../../../common/constants/permissions';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { CtcOptimiserController } from '../ctc-optimiser.controller';

/**
 * Registry consistency test — ensures backend P, frontend P,
 * controller decorators, and sidebar all reference the same canonical values.
 *
 * This catches drift where someone adds a permission in one place
 * but uses a different string elsewhere.
 */
describe('CTC Optimiser Permission Registry Consistency', () => {
  const CANONICAL = [
    'payroll:ctc_optimiser:run',
    'payroll:ctc_optimiser:view',
    'payroll:ctc_optimiser:apply',
    'payroll:ctc_optimiser:approve',
  ];

  describe('backend constants match canonical set', () => {
    it('P.CTC_OPTIMISER_* values match canonical strings', () => {
      expect(BackendP.CTC_OPTIMISER_RUN).toBe('payroll:ctc_optimiser:run');
      expect(BackendP.CTC_OPTIMISER_VIEW).toBe('payroll:ctc_optimiser:view');
      expect(BackendP.CTC_OPTIMISER_APPLY).toBe('payroll:ctc_optimiser:apply');
      expect(BackendP.CTC_OPTIMISER_APPROVE).toBe('payroll:ctc_optimiser:approve');
    });

    it('CTC_OPTIMISER_ALL contains exactly 4 entries', () => {
      expect(CTC_OPTIMISER_ALL).toHaveLength(4);
      for (const perm of CANONICAL) {
        expect(CTC_OPTIMISER_ALL).toContain(perm);
      }
    });
  });

  describe('controller decorators use backend P constants', () => {
    it('run handler uses the canonical run permission', () => {
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, CtcOptimiserController.prototype.run);
      expect(perms).toContain(BackendP.CTC_OPTIMISER_RUN);
    });

    it('getRun handler uses the canonical view permission', () => {
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, CtcOptimiserController.prototype.getRun);
      expect(perms).toContain(BackendP.CTC_OPTIMISER_VIEW);
    });

    it('apply handler uses the canonical apply permission', () => {
      const perms = Reflect.getMetadata(PERMISSIONS_KEY, CtcOptimiserController.prototype.apply);
      expect(perms).toContain(BackendP.CTC_OPTIMISER_APPLY);
    });
  });

  describe('frontend permissions file is in sync', () => {
    it('frontend permissions.ts contains all canonical CTC permission strings', () => {
      const frontendPath = path.resolve(
        __dirname,
        '../../../../admin-portal/src/constants/permissions.ts',
      );
      const content = fs.readFileSync(frontendPath, 'utf-8');

      for (const perm of CANONICAL) {
        expect(content).toContain(`'${perm}'`);
      }
    });

    it('frontend does not contain banned permission variants', () => {
      const frontendPath = path.resolve(
        __dirname,
        '../../../../admin-portal/src/constants/permissions.ts',
      );
      const content = fs.readFileSync(frontendPath, 'utf-8');

      const banned = [
        'payroll.ctcOptimiser',
        'payroll:ctcOptimiser:',
        'compensation.ctc_optimiser',
        'ctc-optimiser:',
        'ctcoptimiser',
      ];

      for (const bad of banned) {
        expect(content).not.toContain(bad);
      }
    });
  });

  describe('sidebar uses canonical permission', () => {
    it('AdminLayout.tsx references the canonical view permission', () => {
      const layoutPath = path.resolve(
        __dirname,
        '../../../../admin-portal/src/components/AdminLayout.tsx',
      );
      const content = fs.readFileSync(layoutPath, 'utf-8');

      expect(content).toContain("'payroll:ctc_optimiser:view'");
    });
  });
});
