import { Test, TestingModule } from '@nestjs/testing';
import { RolesService } from '../roles.service';
import { PrismaService } from '../../../core/database/prisma.service';
import { AuditService } from '../../../core/audit/audit.service';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('RolesService', () => {
  let service: RolesService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesService,
        {
          provide: PrismaService,
          useValue: {
            role: {
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              create: jest.fn(),
            },
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

    service = module.get<RolesService>(RolesService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('update', () => {
    it('throws ForbiddenException when updating a system role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        isSystemRole: true,
      });

      await expect(service.update('1', { name: 'New Name' }, 'actor1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for invalid permissions', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        isSystemRole: false,
      });

      await expect(
        service.update('1', { permissions: ['invalid:permission'] }, 'actor1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('remove', () => {
    it('throws ForbiddenException when deleting a system role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: '1',
        isSystemRole: true,
      });

      await expect(service.remove('1', 'actor1')).rejects.toThrow(ForbiddenException);
    });
  });
});
