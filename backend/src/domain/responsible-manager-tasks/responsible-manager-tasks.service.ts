import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ResponsibleManagerAccountabilityStatus,
  ResponsibleManagerTaskStatus,
  ResponsibleManagerTaskType,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { buildResponsibleManagerEngagementFilter } from '../../core/auth/utils/responsible-manager-scope.helper';
import { QueryResponsibleManagerTaskDto } from './dto/query-responsible-manager-task.dto';
import { CompleteResponsibleManagerTaskDto } from './dto/complete-responsible-manager-task.dto';
import {
  PaginatedResponsibleManagerTaskResponseDto,
  ResponsibleManagerTaskResponseDto,
} from './dto/responsible-manager-task-response.dto';
import {
  deriveResponsibleManagerTaskTypes,
  taskDescriptionForType,
  taskTitleForType,
} from './responsible-manager-task-sync';

const TASK_INCLUDE = {
  engagement: {
    select: {
      id: true,
      role: true,
      responsibleManagerStatus: true,
      contractor: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          accessIntent: true,
        },
      },
      contract: {
        select: {
          contractNumber: true,
          title: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ResponsibleManagerTasksService {
  constructor(private readonly prisma: PrismaService) {}

  private requireResponsibleManagerScope(accessContext: AccessContext): string {
    if (!accessContext.responsibleManagerEmployeeId) {
      throw new ForbiddenException(
        'HCM-linked sponsor identity (User.externalId) is required for sponsor tasks',
      );
    }
    if (!accessContext.targetOrganizationId) {
      throw new BadRequestException('Organization context is required');
    }
    return accessContext.responsibleManagerEmployeeId;
  }

  /** Upsert OPEN tasks for sponsored engagements (no IGA side effects). */
  async syncOpenTasks(accessContext: AccessContext): Promise<void> {
    const responsibleManagerEmployeeId = accessContext.responsibleManagerEmployeeId;
    const organizationId = accessContext.targetOrganizationId;
    if (!responsibleManagerEmployeeId || !organizationId) {
      return;
    }

    const sponsorFilter = buildResponsibleManagerEngagementFilter(accessContext);
    if (!sponsorFilter) {
      return;
    }

    const engagements = await this.prisma.contractorEngagement.findMany({
      where: {
        contractor: {
          supplier: { organizationId },
        },
        AND: [sponsorFilter],
      },
      include: {
        contractor: { select: { accessIntent: true } },
      },
    });

    const now = new Date();
    for (const engagement of engagements) {
      const types = deriveResponsibleManagerTaskTypes(engagement, now);
      for (const taskType of types) {
        const existing = await this.prisma.responsibleManagerAccountabilityTask.findFirst({
          where: {
            engagementId: engagement.id,
            taskType,
            status: ResponsibleManagerTaskStatus.OPEN,
          },
        });
        if (existing) {
          continue;
        }
        await this.prisma.responsibleManagerAccountabilityTask.create({
          data: {
            organizationId,
            engagementId: engagement.id,
            contractorId: engagement.contractorId,
            responsibleManagerEmployeeId,
            taskType,
            title: taskTitleForType(taskType),
            description: taskDescriptionForType(taskType),
            dueAt:
              taskType === ResponsibleManagerTaskType.RENEWAL_REVIEW && engagement.endDate
                ? engagement.endDate
                : null,
          },
        });
      }
    }
  }

  async findAll(
    accessContext: AccessContext,
    query: QueryResponsibleManagerTaskDto,
  ): Promise<PaginatedResponsibleManagerTaskResponseDto> {
    const responsibleManagerEmployeeId = this.requireResponsibleManagerScope(accessContext);
    await this.syncOpenTasks(accessContext);

    const { status, page = 1, limit = 20 } = query;
    const where = {
      organizationId: accessContext.targetOrganizationId!,
      responsibleManagerEmployeeId,
      ...(status ? { status } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.responsibleManagerAccountabilityTask.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }, { createdAt: 'desc' }],
        include: TASK_INCLUDE,
      }),
      this.prisma.responsibleManagerAccountabilityTask.count({ where }),
    ]);

    return {
      data: data as unknown as ResponsibleManagerTaskResponseDto[],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async findOne(
    accessContext: AccessContext,
    id: string,
  ): Promise<ResponsibleManagerTaskResponseDto> {
    const responsibleManagerEmployeeId = this.requireResponsibleManagerScope(accessContext);
    const task = await this.prisma.responsibleManagerAccountabilityTask.findFirst({
      where: {
        id,
        responsibleManagerEmployeeId,
        organizationId: accessContext.targetOrganizationId!,
      },
      include: TASK_INCLUDE,
    });
    if (!task) {
      throw new NotFoundException('Sponsor task not found');
    }
    return task as unknown as ResponsibleManagerTaskResponseDto;
  }

  async complete(
    accessContext: AccessContext,
    id: string,
    dto: CompleteResponsibleManagerTaskDto,
  ): Promise<ResponsibleManagerTaskResponseDto> {
    const task = await this.findOne(accessContext, id);
    if (task.status !== ResponsibleManagerTaskStatus.OPEN) {
      throw new BadRequestException('Task is not open');
    }

    const outcome = {
      notes: dto.notes ?? null,
      accessConfirmed: dto.accessConfirmed ?? null,
      completedAt: new Date().toISOString(),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.responsibleManagerAccountabilityTask.update({
        where: { id },
        data: {
          status: ResponsibleManagerTaskStatus.COMPLETED,
          completedAt: new Date(),
          completedByUserId: accessContext.actorUserId,
          outcome,
        },
        include: TASK_INCLUDE,
      });

      if (task.taskType === ResponsibleManagerTaskType.CERTIFICATION_READINESS) {
        await tx.contractorEngagement.update({
          where: { id: task.engagementId },
          data: { responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ACTIVE },
        });
      }

      return row;
    });

    return updated as unknown as ResponsibleManagerTaskResponseDto;
  }

  async dismiss(
    accessContext: AccessContext,
    id: string,
    notes?: string,
  ): Promise<ResponsibleManagerTaskResponseDto> {
    const task = await this.findOne(accessContext, id);
    if (task.status !== ResponsibleManagerTaskStatus.OPEN) {
      throw new BadRequestException('Task is not open');
    }

    const updated = await this.prisma.responsibleManagerAccountabilityTask.update({
      where: { id },
      data: {
        status: ResponsibleManagerTaskStatus.DISMISSED,
        completedAt: new Date(),
        completedByUserId: accessContext.actorUserId,
        outcome: { dismissed: true, notes: notes ?? null },
      },
      include: TASK_INCLUDE,
    });

    return updated as unknown as ResponsibleManagerTaskResponseDto;
  }
}
