import { TaxTablePublishProjectionService } from '../tax-table-publish-projection.service';
import { TaxTableTemplateRegistry } from '../templates';
import { TTA_ERROR_CODES, TtaException } from '../types/error-codes';

function mockVersion(overrides: any = {}) {
  return {
    id: 'av-1',
    countryCode: 'LS',
    tableType: 'PAYE',
    taxYear: '2025/2026',
    effectiveFrom: new Date('2025-04-01'),
    effectiveTo: null,
    status: 'APPROVED',
    sourceType: 'TEMPLATE',
    sourceReference: 'LRA',
    sourceChecksum: null,
    copiedFromAuthoringId: null,
    publishedTaxTableSetId: null,
    publishReason: null,
    createdByUserId: 'user-1',
    reviewedByUserId: 'user-2',
    publishedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    brackets: [
      { id: 'b1', seqNo: 1, bracketFrom: 0, bracketTo: 237100, marginalRate: 0.18, baseTax: 0, isOpenEnded: false },
      { id: 'b2', seqNo: 2, bracketFrom: 237100, bracketTo: null, marginalRate: 0.30, baseTax: 42678, isOpenEnded: true },
    ],
    fields: [{ id: 'f1', fieldCode: 'annual_tax_credit', fieldValueJson: 11640 }],
    ...overrides,
  };
}

describe('TaxTablePublishProjectionService', () => {
  describe('idempotency guard (TTA-HARDEN-003)', () => {
    it('should reject publish on already-published version', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn((fn: any) => fn(mockPrisma)),
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue(mockVersion({
            status: 'PUBLISHED',
            publishedTaxTableSetId: 'existing-runtime',
            publishedAt: new Date(),
          })),
        },
      };

      const service = new TaxTablePublishProjectionService(
        mockPrisma as any,
        { assertPublishable: jest.fn() } as any,
        new TaxTableTemplateRegistry(),
      );

      await expect(
        service.publishAuthoringVersion({
          authoringVersionId: 'av-1',
          actorUserId: 'user-3',
        }),
      ).rejects.toThrow(TtaException);

      try {
        await service.publishAuthoringVersion({
          authoringVersionId: 'av-1',
          actorUserId: 'user-3',
        });
      } catch (e) {
        expect((e as TtaException).code).toBe(TTA_ERROR_CODES.ALREADY_PUBLISHED);
      }
    });
  });

  describe('status gate', () => {
    it('should reject ARCHIVED versions', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn((fn: any) => fn(mockPrisma)),
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue(mockVersion({ status: 'ARCHIVED' })),
        },
      };

      const service = new TaxTablePublishProjectionService(
        mockPrisma as any,
        { assertPublishable: jest.fn() } as any,
        new TaxTableTemplateRegistry(),
      );

      try {
        await service.publishAuthoringVersion({
          authoringVersionId: 'av-1',
          actorUserId: 'user-3',
        });
        fail('Should have thrown');
      } catch (e) {
        expect((e as TtaException).code).toBe(TTA_ERROR_CODES.INVALID_STATUS);
      }
    });

    it('should reject PENDING_APPROVAL versions', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn((fn: any) => fn(mockPrisma)),
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue(mockVersion({ status: 'PENDING_APPROVAL' })),
        },
      };

      const service = new TaxTablePublishProjectionService(
        mockPrisma as any,
        { assertPublishable: jest.fn() } as any,
        new TaxTableTemplateRegistry(),
      );

      try {
        await service.publishAuthoringVersion({
          authoringVersionId: 'av-1',
          actorUserId: 'user-3',
        });
        fail('Should have thrown');
      } catch (e) {
        expect((e as TtaException).code).toBe(TTA_ERROR_CODES.INVALID_STATUS);
      }
    });
  });

  describe('approval policy enforcement (TTA-HARDEN-008)', () => {
    it('should reject DRAFT when requireApprovalBeforePublish is true', async () => {
      const mockPrisma: any = {
        $transaction: jest.fn((fn: any) => fn(mockPrisma)),
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue(mockVersion({ status: 'DRAFT' })),
        },
      };

      const service = new TaxTablePublishProjectionService(
        mockPrisma as any,
        { assertPublishable: jest.fn() } as any,
        new TaxTableTemplateRegistry(),
      );
      service.updatePolicy({ requireApprovalBeforePublish: true });

      try {
        await service.publishAuthoringVersion({
          authoringVersionId: 'av-1',
          actorUserId: 'user-3',
        });
        fail('Should have thrown');
      } catch (e) {
        expect((e as TtaException).code).toBe(TTA_ERROR_CODES.PUBLISH_APPROVAL_REQUIRED);
      }
    });
  });

  describe('publish atomicity (TTA-HARDEN-001)', () => {
    it('should create runtime row before superseding prior active', async () => {
      const callOrder: string[] = [];

      const mockPrisma: any = {
        $transaction: jest.fn((fn: any) => fn(mockPrisma)),
        taxTableAuthoringVersion: {
          findUnique: jest.fn().mockResolvedValue(mockVersion()),
          update: jest.fn().mockImplementation(() => {
            callOrder.push('authoring_update');
            return Promise.resolve({});
          }),
        },
        taxTableSet: {
          findFirst: jest.fn().mockResolvedValue({ id: 'old-runtime' }),
          create: jest.fn().mockImplementation(() => {
            callOrder.push('runtime_create');
            return Promise.resolve({ id: 'new-runtime' });
          }),
          update: jest.fn().mockImplementation(() => {
            callOrder.push('runtime_supersede');
            return Promise.resolve({});
          }),
        },
        taxTableAuthoringAuditEvent: {
          create: jest.fn().mockResolvedValue({}),
        },
      };

      const service = new TaxTablePublishProjectionService(
        mockPrisma as any,
        { assertPublishable: jest.fn() } as any,
        new TaxTableTemplateRegistry(),
      );

      await service.publishAuthoringVersion({
        authoringVersionId: 'av-1',
        actorUserId: 'user-3',
      });

      const createIdx = callOrder.indexOf('runtime_create');
      const supersedeIdx = callOrder.indexOf('runtime_supersede');
      expect(createIdx).toBeLessThan(supersedeIdx);
    });
  });
});
