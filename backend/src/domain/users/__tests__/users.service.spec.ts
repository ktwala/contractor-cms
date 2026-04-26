import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from '../users.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { ConflictException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
              create: jest.fn(),
            },
            userRole: {
              count: jest.fn(),
              deleteMany: jest.fn(),
              create: jest.fn(),
            },
            role: {
              findMany: jest.fn(),
            },
            $transaction: jest.fn().mockImplementation((arr) => Promise.all(arr)),
          },
        },
        {
          provide: AuditService,
          useValue: {
            logAction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('update', () => {
    it('throws ConflictException when deactivating the last active CMS_ADMIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        isActive: true,
        roles: [{ role: { name: 'CMS_ADMIN' } }],
      });

      (prisma.userRole.count as jest.Mock).mockResolvedValue(0); // 0 other admins

      await expect(
        service.update('1', { isActive: false }, 'actor1'),
      ).rejects.toThrow(ConflictException);
    });

    it('allows deactivating CMS_ADMIN if another active CMS_ADMIN exists', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        isActive: true,
        roles: [{ role: { name: 'CMS_ADMIN' } }],
      });

      (prisma.userRole.count as jest.Mock).mockResolvedValue(1); // 1 other admin
      (prisma.user.update as jest.Mock).mockResolvedValue({
        id: '1',
        isActive: false,
      });

      const result = await service.update('1', { isActive: false }, 'actor1');
      expect(result.isActive).toBe(false);
    });
  });

  describe('assignRoles', () => {
    it('throws ConflictException when removing CMS_ADMIN from the last active CMS_ADMIN', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        isActive: true,
        roles: [{ role: { name: 'CMS_ADMIN' } }],
      });

      (prisma.role.findMany as jest.Mock).mockResolvedValue([{ name: 'OTHER_ROLE' }]);
      (prisma.userRole.count as jest.Mock).mockResolvedValue(0);

      await expect(
        service.assignRoles('1', { roleIds: ['role2'] }, 'actor1'),
      ).rejects.toThrow(ConflictException);
    });
  });
});
