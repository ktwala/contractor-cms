import { Test, TestingModule } from '@nestjs/testing';
import { OrgContextResolverService } from './org-context-resolver.service';
import { PrismaService } from '../../database/prisma.service';

describe('OrgContextResolverService', () => {
  let service: OrgContextResolverService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      contractor: {
        findUnique: jest.fn(),
      },
      timesheet: {
        findUnique: jest.fn(),
      },
      withholdingInstruction: {
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrgContextResolverService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<OrgContextResolverService>(OrgContextResolverService);
  });

  it('should resolve Contractor lookup correctly', async () => {
    prismaMock.contractor.findUnique.mockResolvedValue({
      organizationId: 'org-123',
    });

    const res = await service.resolveTargetOrgId(
      { body: { contractorId: 'c-1' } },
      { type: 'body', key: 'contractorId', lookup: 'Contractor' },
    );

    expect(res).toBe('org-123');
    expect(prismaMock.contractor.findUnique).toHaveBeenCalledWith({
      where: { id: 'c-1' },
      select: {
        organizationId: true,
        supplier: { select: { organizationId: true } },
      },
    });
  });

  it('should resolve Timesheet lookup correctly', async () => {
    prismaMock.timesheet.findUnique.mockResolvedValue({
      contractor: { supplier: { organizationId: 'org-456' } },
    });

    const res = await service.resolveTargetOrgId(
      { params: { id: 't-1' } },
      { type: 'param', key: 'id', lookup: 'Timesheet' },
    );

    expect(res).toBe('org-456');
  });

  it('should resolve camelCase WithholdingInstruction lookup correctly', async () => {
    prismaMock.withholdingInstruction.findUnique.mockResolvedValue({
      organizationId: 'org-789',
    });

    const res = await service.resolveTargetOrgId(
      { params: { id: 'w-1' } },
      { type: 'param', key: 'id', lookup: 'WithholdingInstruction' },
    );

    expect(res).toBe('org-789');
    expect(prismaMock.withholdingInstruction.findUnique).toHaveBeenCalledWith({
      where: { id: 'w-1' },
      select: { organizationId: true },
    });
  });

  it('should resolve Project lookup correctly', async () => {
    prismaMock.project.findUnique.mockResolvedValue({
      organizationId: 'org-abc',
    });

    const res = await service.resolveTargetOrgId(
      { params: { id: 'p-1' } },
      { type: 'param', key: 'id', lookup: 'Project' },
    );

    expect(res).toBe('org-abc');
  });

  it('should fail closed when model is unsupported or does not exist on PrismaService', async () => {
    const res = await service.resolveTargetOrgId(
      { params: { id: 'x-1' } },
      { type: 'param', key: 'id', lookup: 'NonExistentModel' },
    );

    expect(res).toBeNull();
  });
});
