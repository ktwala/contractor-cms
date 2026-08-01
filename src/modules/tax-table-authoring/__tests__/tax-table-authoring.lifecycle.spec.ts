import { TaxTableAuthoringService } from '../tax-table-authoring.service';
import { TtaException } from '../types/error-codes';

describe('TaxTableAuthoringService - Lifecycle', () => {
  describe('SoD enforcement (TTA-HARDEN-007)', () => {
    it('should block self-approval when disallowSelfApproval is true', async () => {
      const mockPrisma = {
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'av-1',
            status: 'PENDING_APPROVAL',
            createdByUserId: 'user-1',
          }),
        },
        $transaction: jest.fn(),
      };

      const service = new TaxTableAuthoringService(
        mockPrisma as any,
        {} as any,
      );

      await expect(
        service.approve('av-1', 'user-1', undefined, { disallowSelfApproval: true }),
      ).rejects.toThrow(TtaException);

      try {
        await service.approve('av-1', 'user-1', undefined, { disallowSelfApproval: true });
      } catch (e) {
        expect((e as TtaException).code).toBe('TTA_SELF_APPROVAL_BLOCKED');
      }
    });

    it('should allow approval by a different user', async () => {
      const mockPrisma: any = {
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'av-1',
            status: 'PENDING_APPROVAL',
            createdByUserId: 'user-1',
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        taxTableAuthoringAuditEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
        $transaction: jest.fn((fn: any) => fn(mockPrisma)),
      };

      const mockGetById = jest.fn().mockResolvedValue({ id: 'av-1', status: 'APPROVED' });
      const service = new TaxTableAuthoringService(
        mockPrisma as any,
        {} as any,
      );
      (service as any).getById = mockGetById;

      const result = await service.approve('av-1', 'user-2', undefined, { disallowSelfApproval: true });
      expect(result.status).toBe('APPROVED');
    });
  });

  describe('status transitions', () => {
    it('should reject edits on non-DRAFT versions', async () => {
      const mockPrisma = {
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'av-1',
            status: 'PUBLISHED',
          }),
        },
      };

      const service = new TaxTableAuthoringService(
        mockPrisma as any,
        {} as any,
      );

      await expect(
        service.updateBrackets('av-1', [], 'user-1'),
      ).rejects.toThrow(TtaException);
    });

    it('should reject approval on non-PENDING_APPROVAL versions', async () => {
      const mockPrisma = {
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'av-1',
            status: 'DRAFT',
          }),
        },
      };

      const service = new TaxTableAuthoringService(
        mockPrisma as any,
        {} as any,
      );

      await expect(
        service.approve('av-1', 'user-2'),
      ).rejects.toThrow(TtaException);
    });

    it('should reject archiving PUBLISHED versions', async () => {
      const mockPrisma = {
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'av-1',
            status: 'PUBLISHED',
          }),
        },
      };

      const service = new TaxTableAuthoringService(
        mockPrisma as any,
        {} as any,
      );

      await expect(
        service.archive('av-1', 'user-1'),
      ).rejects.toThrow(TtaException);
    });

    it('should return 404 for non-existent versions', async () => {
      const mockPrisma = {
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };

      const service = new TaxTableAuthoringService(
        mockPrisma as any,
        {} as any,
      );

      try {
        await service.approve('non-existent', 'user-1');
        fail('Should have thrown');
      } catch (e) {
        expect((e as TtaException).code).toBe('TTA_NOT_FOUND');
        expect((e as TtaException).httpStatus).toBe(404);
      }
    });
  });
});
