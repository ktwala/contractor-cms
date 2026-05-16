import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { QueryProjectDto } from './dto/query-project.dto';
import {
  PaginatedProjectResponseDto,
  ProjectResponseDto,
} from './dto/project-response.dto';
import { Prisma } from '@prisma/client';

import { AccessContext } from '../../core/auth/interfaces/access-context.interface';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    accessContext: AccessContext,
    createProjectDto: CreateProjectDto,
  ): Promise<ProjectResponseDto> {
    const targetOrgId = accessContext.targetOrganizationId;
    if (!targetOrgId) throw new BadRequestException('Organization context is required');
    // Check for duplicate project code within organization
    const existingProject = await this.prisma.project.findFirst({
      where: {
        organizationId: targetOrgId,
        code: createProjectDto.code,
      },
    });

    if (existingProject) {
      throw new ConflictException(
        'A project with this code already exists in your organization',
      );
    }

    // Validate dates
    if (createProjectDto.startDate && createProjectDto.endDate) {
      const startDate = new Date(createProjectDto.startDate);
      const endDate = new Date(createProjectDto.endDate);

      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const project = await this.prisma.project.create({
      data: {
        organizationId: targetOrgId,
        code: createProjectDto.code,
        name: createProjectDto.name,
        description: createProjectDto.description,
        clientName: createProjectDto.clientName,
        startDate: createProjectDto.startDate
          ? new Date(createProjectDto.startDate)
          : undefined,
        endDate: createProjectDto.endDate
          ? new Date(createProjectDto.endDate)
          : undefined,
        budget: createProjectDto.budget
          ? new Prisma.Decimal(createProjectDto.budget)
          : undefined,
        currency: createProjectDto.currency || 'ZAR',
        costCenterId: createProjectDto.costCenterId,
        status: 'ACTIVE',
      },
    });

    return project as any;
  }

  async findAll(
    accessContext: AccessContext,
    query: QueryProjectDto,
  ): Promise<PaginatedProjectResponseDto> {
    const { search, status, clientName, costCenterId, page = 1, limit = 20 } = query;

    const where: any = accessContext.isGlobalAccess ? {} : {
      organizationId: accessContext.targetOrganizationId,
    };

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    if (clientName) {
      where.clientName = { contains: clientName, mode: 'insensitive' };
    }

    if (costCenterId) {
      where.costCenterId = costCenterId;
    }

    const [projects, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              engagements: true,
              timesheets: true,
              tasks: true,
            },
          },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return {
      data: projects as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    accessContext: AccessContext,
    id: string,
  ): Promise<ProjectResponseDto> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    const project = await this.prisma.project.findFirst({
      where,
      include: {
        _count: {
          select: {
            engagements: true,
            timesheets: true,
            tasks: true,
          },
        },
        engagements: {
          select: {
            id: true,
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            role: true,
            isActive: true,
          },
        },
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    return project as any;
  }

  async update(
    accessContext: AccessContext,
    id: string,
    updateProjectDto: UpdateProjectDto,
  ): Promise<ProjectResponseDto> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    // Check if project exists and belongs to organization
    const existingProject = await this.prisma.project.findFirst({
      where,
    });

    if (!existingProject) {
      throw new NotFoundException('Project not found');
    }

    // Check for code conflict if code is being changed
    if (
      updateProjectDto.code &&
      updateProjectDto.code !== existingProject.code
    ) {
      const codeConflict = await this.prisma.project.findFirst({
        where: {
          organizationId: accessContext.targetOrganizationId!,
          code: updateProjectDto.code,
          id: { not: id },
        },
      });

      if (codeConflict) {
        throw new ConflictException(
          'A project with this code already exists in your organization',
        );
      }
    }

    // Validate dates if being updated
    const startDate = updateProjectDto.startDate
      ? new Date(updateProjectDto.startDate)
      : existingProject.startDate;
    const endDate = updateProjectDto.endDate
      ? new Date(updateProjectDto.endDate)
      : existingProject.endDate;

    if (startDate && endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const project = await this.prisma.project.update({
      where: { id },
      data: {
        code: updateProjectDto.code,
        name: updateProjectDto.name,
        description: updateProjectDto.description,
        clientName: updateProjectDto.clientName,
        startDate: updateProjectDto.startDate
          ? new Date(updateProjectDto.startDate)
          : undefined,
        endDate: updateProjectDto.endDate
          ? new Date(updateProjectDto.endDate)
          : undefined,
        budget: updateProjectDto.budget
          ? new Prisma.Decimal(updateProjectDto.budget)
          : undefined,
        currency: updateProjectDto.currency,
        costCenterId: updateProjectDto.costCenterId,
        status: updateProjectDto.status,
      },
      include: {
        _count: {
          select: {
            engagements: true,
            timesheets: true,
            tasks: true,
          },
        },
      },
    });

    return project as any;
  }

  async remove(accessContext: AccessContext, id: string): Promise<void> {
    const where: any = { id };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    const project = await this.prisma.project.findFirst({
      where,
      include: {
        engagements: true,
        timesheets: true,
        tasks: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Check if project has engagements
    if (project.engagements.length > 0) {
      throw new BadRequestException(
        'Cannot delete project with existing engagements',
      );
    }

    // Check if project has timesheets
    if (project.timesheets.length > 0) {
      throw new BadRequestException(
        'Cannot delete project with existing timesheets',
      );
    }

    await this.prisma.project.delete({
      where: { id },
    });
  }

  async getBudgetUtilization(
    accessContext: AccessContext,
    id: string,
  ): Promise<{
    project: ProjectResponseDto;
    budget: number | null;
    totalInvoiced: number;
    totalPaid: number;
    budgetRemaining: number | null;
    utilizationPercentage: number | null;
  }> {
    const project = await this.findOne(accessContext, id);

    if (!project.budget) {
      return {
        project,
        budget: null,
        totalInvoiced: 0,
        totalPaid: 0,
        budgetRemaining: null,
        utilizationPercentage: null,
      };
    }

    const where: any = {
      timesheets: {
        some: {
          projectId: id,
        },
      },
    };
    if (!accessContext.isGlobalAccess) {
      where.organizationId = accessContext.targetOrganizationId;
    }

    // Get all invoices for this project's timesheets
    const invoices = await this.prisma.invoice.findMany({
      where,
      select: {
        totalAmount: true,
        status: true,
      },
    });

    const totalInvoiced = invoices.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount),
      0,
    );

    const totalPaid = invoices
      .filter((invoice) => invoice.status === 'PAID')
      .reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);

    const budget = Number(project.budget);
    const budgetRemaining = budget - totalInvoiced;
    const utilizationPercentage = (totalInvoiced / budget) * 100;

    return {
      project,
      budget,
      totalInvoiced,
      totalPaid,
      budgetRemaining,
      utilizationPercentage,
    };
  }
}
