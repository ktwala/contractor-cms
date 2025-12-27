import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateTimesheetDto } from './dto/create-timesheet.dto';
import { UpdateTimesheetDto } from './dto/update-timesheet.dto';
import { QueryTimesheetDto, TimesheetStatus } from './dto/query-timesheet.dto';
import {
  PaginatedTimesheetResponseDto,
  TimesheetResponseDto,
} from './dto/timesheet-response.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TimesheetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createTimesheetDto: CreateTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    // Verify contractor exists and belongs to organization
    const contractor = await this.prisma.contractor.findFirst({
      where: {
        id: createTimesheetDto.contractorId,
        supplier: {
          organizationId,
        },
      },
    });

    if (!contractor) {
      throw new NotFoundException(
        'Contractor not found in your organization',
      );
    }

    // Verify project exists and belongs to organization (if provided)
    if (createTimesheetDto.projectId) {
      const project = await this.prisma.project.findFirst({
        where: {
          id: createTimesheetDto.projectId,
          organizationId,
        },
      });

      if (!project) {
        throw new NotFoundException('Project not found in your organization');
      }
    }

    // Validate period dates
    const periodStart = new Date(createTimesheetDto.periodStart);
    const periodEnd = new Date(createTimesheetDto.periodEnd);

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Period end must be after period start');
    }

    // Validate entries are within period
    for (const entry of createTimesheetDto.entries) {
      const entryDate = new Date(entry.date);
      if (entryDate < periodStart || entryDate > periodEnd) {
        throw new BadRequestException(
          `Entry date ${entry.date} is outside the timesheet period`,
        );
      }
    }

    // Calculate total hours
    const totalHours = createTimesheetDto.entries.reduce(
      (sum, entry) => sum + entry.hours,
      0,
    );

    // Create timesheet with entries
    const timesheet = await this.prisma.timesheet.create({
      data: {
        contractorId: createTimesheetDto.contractorId,
        projectId: createTimesheetDto.projectId,
        taskId: createTimesheetDto.taskId,
        periodStart,
        periodEnd,
        totalHours: new Decimal(totalHours),
        status: 'DRAFT',
        entries: {
          create: createTimesheetDto.entries.map((entry) => ({
            date: new Date(entry.date),
            hours: new Decimal(entry.hours),
            description: entry.description,
            taskId: entry.taskId,
          })),
        },
      },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return timesheet as any;
  }

  async findAll(
    organizationId: string,
    query: QueryTimesheetDto,
  ): Promise<PaginatedTimesheetResponseDto> {
    const {
      contractorId,
      projectId,
      status,
      periodStart,
      periodEnd,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      contractor: {
        supplier: {
          organizationId,
        },
      },
    };

    if (contractorId) {
      where.contractorId = contractorId;
    }

    if (projectId) {
      where.projectId = projectId;
    }

    if (status) {
      where.status = status;
    }

    if (periodStart) {
      where.periodStart = { gte: new Date(periodStart) };
    }

    if (periodEnd) {
      where.periodEnd = { lte: new Date(periodEnd) };
    }

    const [timesheets, total] = await Promise.all([
      this.prisma.timesheet.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          entries: {
            orderBy: { date: 'asc' },
          },
          contractor: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      }),
      this.prisma.timesheet.count({ where }),
    ]);

    return {
      data: timesheets as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    return timesheet as any;
  }

  async update(
    organizationId: string,
    id: string,
    updateTimesheetDto: UpdateTimesheetDto,
  ): Promise<TimesheetResponseDto> {
    // Check if timesheet exists and belongs to organization
    const existingTimesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
      include: {
        entries: true,
      },
    });

    if (!existingTimesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    // Only allow updates to DRAFT timesheets
    if (existingTimesheet.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft timesheets can be updated. Please create a new timesheet.',
      );
    }

    // Validate period dates if being updated
    const periodStart = updateTimesheetDto.periodStart
      ? new Date(updateTimesheetDto.periodStart)
      : existingTimesheet.periodStart;
    const periodEnd = updateTimesheetDto.periodEnd
      ? new Date(updateTimesheetDto.periodEnd)
      : existingTimesheet.periodEnd;

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Period end must be after period start');
    }

    // If updating entries, validate and recalculate total hours
    let totalHours = existingTimesheet.totalHours;
    if (updateTimesheetDto.entries) {
      // Validate entries are within period
      for (const entry of updateTimesheetDto.entries) {
        const entryDate = new Date(entry.date);
        if (entryDate < periodStart || entryDate > periodEnd) {
          throw new BadRequestException(
            `Entry date ${entry.date} is outside the timesheet period`,
          );
        }
      }

      // Calculate new total hours
      totalHours = new Decimal(
        updateTimesheetDto.entries.reduce((sum, entry) => sum + entry.hours, 0),
      );

      // Delete existing entries and create new ones
      await this.prisma.timesheetEntry.deleteMany({
        where: { timesheetId: id },
      });
    }

    const timesheet = await this.prisma.timesheet.update({
      where: { id },
      data: {
        projectId: updateTimesheetDto.projectId,
        taskId: updateTimesheetDto.taskId,
        periodStart: updateTimesheetDto.periodStart
          ? new Date(updateTimesheetDto.periodStart)
          : undefined,
        periodEnd: updateTimesheetDto.periodEnd
          ? new Date(updateTimesheetDto.periodEnd)
          : undefined,
        totalHours,
        entries: updateTimesheetDto.entries
          ? {
              create: updateTimesheetDto.entries.map((entry) => ({
                date: new Date(entry.date),
                hours: new Decimal(entry.hours),
                description: entry.description,
                taskId: entry.taskId,
              })),
            }
          : undefined,
      },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    return timesheet as any;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    // Only allow deletion of DRAFT or REJECTED timesheets
    if (
      timesheet.status !== 'DRAFT' &&
      timesheet.status !== 'REJECTED'
    ) {
      throw new BadRequestException(
        'Only draft or rejected timesheets can be deleted',
      );
    }

    await this.prisma.timesheet.delete({
      where: { id },
    });
  }

  async submit(organizationId: string, id: string): Promise<TimesheetResponseDto> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
      include: {
        entries: true,
      },
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    if (timesheet.status !== 'DRAFT') {
      throw new BadRequestException('Only draft timesheets can be submitted');
    }

    if (timesheet.entries.length === 0) {
      throw new BadRequestException(
        'Cannot submit timesheet with no entries',
      );
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    }) as any;
  }

  async approve(
    organizationId: string,
    id: string,
    approvedBy: string,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    if (timesheet.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted timesheets can be approved');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
        rejectionReason: null,
      },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    }) as any;
  }

  async reject(
    organizationId: string,
    id: string,
    rejectionReason?: string,
  ): Promise<TimesheetResponseDto> {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: {
        id,
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
    });

    if (!timesheet) {
      throw new NotFoundException('Timesheet not found');
    }

    if (timesheet.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted timesheets can be rejected');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || 'Rejected by approver',
        approvedAt: null,
        approvedBy: null,
      },
      include: {
        entries: {
          orderBy: { date: 'asc' },
        },
        contractor: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        project: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    }) as any;
  }
}
