import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from '../audit.controller';
import { AuditService } from '../audit.service';
import { PrismaService } from '../../database/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../../auth/guards/permissions.guard';

// ---------------------------------------------------------------------------
// Mock PrismaService
// ---------------------------------------------------------------------------

const mockPrisma = {
  auditLog: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
};

// Mock guards — unit tests verify controller logic, not auth
const mockGuard = { canActivate: jest.fn().mockReturnValue(true) };

describe('AuditController', () => {
  let controller: AuditController;
  let service: AuditService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .overrideGuard(PermissionsGuard)
      .useValue(mockGuard)
      .compile();

    controller = module.get<AuditController>(AuditController);
    service = module.get<AuditService>(AuditService);

    jest.clearAllMocks();
  });

  // -----------------------------------------------------------------------
  // GET /audit-logs — list
  // -----------------------------------------------------------------------

  describe('GET /audit-logs (list)', () => {
    it('returns paginated results', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          actorUserId: 'user-1',
          action: 'USER_ROLE_ASSIGNED',
          targetType: 'User',
          targetId: 'user-2',
          result: 'success',
          before: null,
          after: { roleName: 'ADMIN' },
          metadata: null,
          ipAddress: '10.0.0.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date('2026-04-27T10:00:00Z'),
          actor: { id: 'user-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
        },
      ];

      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await controller.listLogs({ page: 1, pageSize: 50 });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('total', 1);
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('pageSize');
      expect(result.data).toHaveLength(1);
    });

    it('enforces max pageSize of 100', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await controller.listLogs({ page: 1, pageSize: 999 });

      // Service clamps to 100
      expect(result.pageSize).toBeLessThanOrEqual(100);
    });

    it('filters by action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await controller.listLogs({ action: 'ROLE_CREATED', page: 1, pageSize: 50 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'ROLE_CREATED' }),
        }),
      );
    });

    it('filters by date range', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await controller.listLogs({
        from: '2026-04-01',
        to: '2026-04-27',
        page: 1,
        pageSize: 50,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('filters by result', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await controller.listLogs({ result: 'failed', page: 1, pageSize: 50 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ result: 'failed' }),
        }),
      );
    });

    it('filters by targetType', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await controller.listLogs({ targetType: 'Role', page: 1, pageSize: 50 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ targetType: 'Role' }),
        }),
      );
    });

    it('applies search across actor email, targetId, action', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await controller.listLogs({ search: 'admin', page: 1, pageSize: 50 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ action: expect.any(Object) }),
              expect.objectContaining({ actor: expect.any(Object) }),
            ]),
          }),
        }),
      );
    });
  });

  // -----------------------------------------------------------------------
  // GET /audit-logs/:id — detail
  // -----------------------------------------------------------------------

  describe('GET /audit-logs/:id (detail)', () => {
    it('returns a single log with actor join', async () => {
      const mockLog = {
        id: 'log-1',
        actorUserId: 'user-1',
        action: 'ROLE_CREATED',
        targetType: 'Role',
        targetId: 'role-1',
        result: 'success',
        before: null,
        after: { name: 'NEW_ROLE' },
        metadata: null,
        ipAddress: '10.0.0.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
        actor: { id: 'user-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
      };

      mockPrisma.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await controller.getLog('log-1');

      expect(result.id).toBe('log-1');
      expect(result.actor).toBeDefined();
      expect(result.actor.email).toBe('admin@test.com');
    });

    it('throws 404 for non-existent log', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);

      await expect(controller.getLog('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // -----------------------------------------------------------------------
  // Sensitive field redaction (server-side enforcement)
  // -----------------------------------------------------------------------

  describe('Sensitive field redaction', () => {
    it('redacts sensitive fields in before/after payloads', async () => {
      const mockLog = {
        id: 'log-1',
        actorUserId: 'user-1',
        action: 'USER_UPDATED',
        targetType: 'User',
        targetId: 'user-2',
        result: 'success',
        before: { email: 'old@test.com', passwordHash: 'hash123', token: 'jwt-abc' },
        after: { email: 'new@test.com', passwordHash: 'hash456', apiKey: 'key-xyz' },
        metadata: { secret: 'sensitive-value', action: 'update' },
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        actor: null,
      };

      mockPrisma.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await controller.getLog('log-1');

      // Non-sensitive fields preserved
      expect(result.before.email).toBe('old@test.com');
      expect(result.after.email).toBe('new@test.com');
      expect(result.metadata.action).toBe('update');

      // Sensitive fields redacted
      expect(result.before.passwordHash).toBe('***REDACTED***');
      expect(result.before.token).toBe('***REDACTED***');
      expect(result.after.passwordHash).toBe('***REDACTED***');
      expect(result.after.apiKey).toBe('***REDACTED***');
      expect(result.metadata.secret).toBe('***REDACTED***');
    });

    it('handles null before/after/metadata gracefully', async () => {
      const mockLog = {
        id: 'log-1',
        actorUserId: null,
        action: 'LOGIN_SUCCESS',
        targetType: 'User',
        targetId: 'user-1',
        result: 'success',
        before: null,
        after: null,
        metadata: null,
        ipAddress: '10.0.0.1',
        userAgent: null,
        createdAt: new Date(),
        actor: null,
      };

      mockPrisma.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await controller.getLog('log-1');

      expect(result.before).toBeNull();
      expect(result.after).toBeNull();
      expect(result.metadata).toBeNull();
    });

    it('redacts nested sensitive fields', async () => {
      const mockLog = {
        id: 'log-2',
        actorUserId: null,
        action: 'USER_UPDATED',
        targetType: 'User',
        targetId: 'user-1',
        result: 'success',
        before: null,
        after: {
          profile: {
            name: 'Test',
            credentials: {
              password: 'nested-secret',
              refreshToken: 'nested-token',
            },
          },
        },
        metadata: null,
        ipAddress: null,
        userAgent: null,
        createdAt: new Date(),
        actor: null,
      };

      mockPrisma.auditLog.findUnique.mockResolvedValue(mockLog);

      const result = await controller.getLog('log-2');

      expect(result.after.profile.name).toBe('Test');
      expect(result.after.profile.credentials.password).toBe('***REDACTED***');
      expect(result.after.profile.credentials.refreshToken).toBe('***REDACTED***');
    });
  });

  // -----------------------------------------------------------------------
  // Export limits
  // -----------------------------------------------------------------------

  describe('Export limits', () => {
    it('rejects export with date range > 31 days', async () => {
      const res = {
        header: jest.fn(),
        attachment: jest.fn(),
        send: jest.fn(),
      } as any;

      await expect(
        controller.exportLogs(
          {
            from: '2026-01-01',
            to: '2026-12-31',
            page: 1,
            pageSize: 50,
          },
          res,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('succeeds with date range within 31 days', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);

      const res = {
        header: jest.fn(),
        attachment: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportLogs(
        {
          from: '2026-04-01',
          to: '2026-04-27',
          page: 1,
          pageSize: 50,
        },
        res,
      );

      expect(res.header).toHaveBeenCalledWith('Content-Type', 'text/csv');
      expect(res.send).toHaveBeenCalled();
    });

    it('export redacts sensitive fields in CSV', async () => {
      // Export uses findForExport which calls sanitizeLog
      mockPrisma.auditLog.findMany.mockResolvedValue([
        {
          id: 'log-1',
          actorUserId: 'user-1',
          action: 'USER_UPDATED',
          targetType: 'User',
          targetId: 'user-2',
          result: 'success',
          before: { password: 'secret' },
          after: { password: 'new-secret' },
          metadata: null,
          ipAddress: '10.0.0.1',
          userAgent: null,
          createdAt: new Date('2026-04-27T10:00:00Z'),
          actor: { id: 'user-1', email: 'admin@test.com', firstName: 'Admin', lastName: 'User' },
        },
      ]);

      const res = {
        header: jest.fn(),
        attachment: jest.fn(),
        send: jest.fn(),
      } as any;

      await controller.exportLogs(
        { from: '2026-04-26', to: '2026-04-27', page: 1, pageSize: 50 },
        res,
      );

      // CSV should have been sent (flat format — no JSON blobs)
      const csvContent = res.send.mock.calls[0][0];
      expect(csvContent).toContain('admin@test.com');
      expect(csvContent).not.toContain('secret'); // No raw secrets
    });
  });
});
