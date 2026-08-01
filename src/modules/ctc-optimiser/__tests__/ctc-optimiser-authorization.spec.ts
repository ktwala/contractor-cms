import 'reflect-metadata';
import { P } from '../../../common/constants/permissions';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { CtcOptimiserController } from '../ctc-optimiser.controller';

/**
 * Authorization boundary tests — verify that each controller method
 * requires exactly the intended permission and no more / no less.
 */
describe('CTC Optimiser Authorization Boundaries', () => {
  describe('controller permission decorators', () => {
    it('POST /run requires CTC_OPTIMISER_RUN only', () => {
      const metadata = Reflect.getMetadata(
        PERMISSIONS_KEY,
        CtcOptimiserController.prototype.run,
      );
      expect(metadata).toEqual([P.CTC_OPTIMISER_RUN]);
    });

    it('GET /run/:id requires CTC_OPTIMISER_VIEW only', () => {
      const metadata = Reflect.getMetadata(
        PERMISSIONS_KEY,
        CtcOptimiserController.prototype.getRun,
      );
      expect(metadata).toEqual([P.CTC_OPTIMISER_VIEW]);
    });

    it('POST /apply requires CTC_OPTIMISER_APPLY only', () => {
      const metadata = Reflect.getMetadata(
        PERMISSIONS_KEY,
        CtcOptimiserController.prototype.apply,
      );
      expect(metadata).toEqual([P.CTC_OPTIMISER_APPLY]);
    });
  });

  describe('permission isolation — no capability grants another', () => {
    const allPerms = [
      P.CTC_OPTIMISER_RUN,
      P.CTC_OPTIMISER_VIEW,
      P.CTC_OPTIMISER_APPLY,
      P.CTC_OPTIMISER_APPROVE,
    ];

    it('all four capabilities are distinct strings', () => {
      const unique = new Set(allPerms);
      expect(unique.size).toBe(4);
    });

    it('view does not imply run', () => {
      expect(P.CTC_OPTIMISER_VIEW).not.toBe(P.CTC_OPTIMISER_RUN);
    });

    it('run does not imply apply', () => {
      expect(P.CTC_OPTIMISER_RUN).not.toBe(P.CTC_OPTIMISER_APPLY);
    });

    it('apply does not imply approve', () => {
      expect(P.CTC_OPTIMISER_APPLY).not.toBe(P.CTC_OPTIMISER_APPROVE);
    });
  });

  describe('permission string format', () => {
    it('all use payroll:ctc_optimiser: prefix', () => {
      expect(P.CTC_OPTIMISER_RUN).toMatch(/^payroll:ctc_optimiser:/);
      expect(P.CTC_OPTIMISER_VIEW).toMatch(/^payroll:ctc_optimiser:/);
      expect(P.CTC_OPTIMISER_APPLY).toMatch(/^payroll:ctc_optimiser:/);
      expect(P.CTC_OPTIMISER_APPROVE).toMatch(/^payroll:ctc_optimiser:/);
    });

    it('uses underscores not camelCase in capability names', () => {
      for (const perm of [
        P.CTC_OPTIMISER_RUN,
        P.CTC_OPTIMISER_VIEW,
        P.CTC_OPTIMISER_APPLY,
        P.CTC_OPTIMISER_APPROVE,
      ]) {
        expect(perm).not.toMatch(/[A-Z]/);
      }
    });
  });
});
