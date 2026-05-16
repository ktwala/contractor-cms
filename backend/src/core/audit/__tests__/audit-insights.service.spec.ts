import { Test, TestingModule } from '@nestjs/testing';
import { AuditInsightsService } from '../audit-insights.service';
import { PrismaService } from '../../database/prisma.service';

describe('AuditInsightsService', () => {
  let service: AuditInsightsService;
  let prismaService: Partial<PrismaService>;

  beforeEach(async () => {
    prismaService = {
      auditLog: {
        findMany: jest.fn(),
      } as any,
      user: {
        findMany: jest.fn(),
      } as any,
      supplier: {
        findMany: jest.fn(),
      } as any,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInsightsService,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    service = module.get<AuditInsightsService>(AuditInsightsService);
  });

  describe('buildCrossOrgAttempts', () => {
    it('returns empty when target org cannot be resolved', async () => {
      const logs = [
        {
          id: 'log1',
          action: 'SOME_ACTION',
          targetType: 'UnknownEntity',
          targetId: 'unknown123',
          result: 'success',
          createdAt: new Date(),
          actor: {
            id: 'actor1',
            organizationId: 'org1', // Actor has an org
          },
        },
      ];

      // Since targetType is 'UnknownEntity', the service shouldn't even query the DB for it.
      // And the targetOrg won't be resolvable, so it shouldn't classify it as cross-org.
      const attempts = await (service as any).buildCrossOrgAttempts(logs);

      expect(attempts).toHaveLength(0);
      expect(prismaService.user?.findMany).not.toHaveBeenCalled();
      expect(prismaService.supplier?.findMany).not.toHaveBeenCalled();
    });

    it('returns a cross-org attempt when target org is resolved and differs', async () => {
      const logs = [
        {
          id: 'log1',
          action: 'USER_UPDATED',
          targetType: 'User',
          targetId: 'targetUserId',
          result: 'success',
          createdAt: new Date(),
          actor: {
            id: 'actor1',
            organizationId: 'org1',
          },
        },
      ];

      (prismaService.user?.findMany as jest.Mock).mockResolvedValueOnce([
        { id: 'targetUserId', organizationId: 'org2' },
      ]);

      const attempts = await (service as any).buildCrossOrgAttempts(logs);

      expect(attempts).toHaveLength(1);
      expect(attempts[0].result).toBe('success');
      expect(prismaService.user?.findMany).toHaveBeenCalled();
    });
  });
});
