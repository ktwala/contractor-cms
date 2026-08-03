import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { PatchEmployeeDto } from './dto/patch-employee.dto';
import { ListEmployeesDto } from './dto/list-employees.dto';
import { EmployeeStatus } from '../../common/dto/enums.dto';

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateEmployeeDto, userId?: string, reason?: string) {
    const existing = await this.prisma.employee.findUnique({
      where: { employeeNo: dto.employee_no },
    });

    if (existing) {
      throw new ConflictException({
        code: 'DUPLICATE_EMPLOYEE_NO',
        message: `Employee with employee_no '${dto.employee_no}' already exists`,
      });
    }

    const employee = await this.prisma.employee.create({
      data: {
        employeeNo: dto.employee_no,
        firstName: dto.first_name,
        lastName: dto.last_name,
        nationalId: dto.national_id,
        email: dto.email,
        status: dto.status || EmployeeStatus.ACTIVE,
        hireDate: new Date(dto.hire_date),
        terminationDate: dto.termination_date ? new Date(dto.termination_date) : null,
      },
    });

    await this.auditService.log({
      userId,
      action: 'CREATE',
      entityType: 'Employee',
      entityId: employee.id,
      newValue: employee as any,
      reason,
    });

    return this.mapToResponse(employee);
  }

  async findAll(query: ListEmployeesDto) {
    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }

    if (query.q) {
      where.OR = [
        { firstName: { contains: query.q, mode: 'insensitive' } },
        { lastName: { contains: query.q, mode: 'insensitive' } },
        { employeeNo: { contains: query.q, mode: 'insensitive' } },
        { nationalId: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    if (query.legal_entity_id || query.pay_group_id) {
      where.employments = {
        some: {
          ...(query.legal_entity_id && { legalEntityId: query.legal_entity_id }),
          ...(query.pay_group_id && { payGroupId: query.pay_group_id }),
          effectiveTo: null, // Current employment
        },
      };
    }

    const [items, total, statusGroups] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip: query.offset,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.employee.count({ where }),
      this.prisma.employee.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);

    const statusCounts = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all]),
    );

    return {
      items: items.map(this.mapToResponse),
      total,
      offset: query.offset || 0,
      limit: query.limit || 50,
      status_counts: statusCounts,
    };
  }

  async findOne(id: string) {
    const employee = await this.prisma.employee.findUnique({
      where: { id },
      include: { manager: true },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Employee with id '${id}' not found`,
      });
    }

    return this.mapToResponse(employee);
  }

  async patch(id: string, dto: PatchEmployeeDto, userId?: string, reason?: string) {
    const existing = await this.prisma.employee.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: `Employee with id '${id}' not found`,
      });
    }

    const updateData: any = {};

    if (dto.status !== undefined) {
      updateData.status = dto.status;
    }

    if (dto.termination_date !== undefined) {
      updateData.terminationDate = dto.termination_date ? new Date(dto.termination_date) : null;
    }

    if (dto.email !== undefined) {
      updateData.email = dto.email;
    }

    if (dto.manager_id !== undefined) {
      updateData.managerId = dto.manager_id || null;
    }

    if (dto.first_name !== undefined) {
      updateData.firstName = dto.first_name;
    }

    if (dto.last_name !== undefined) {
      updateData.lastName = dto.last_name;
    }

    if (dto.hire_date !== undefined) {
      updateData.hireDate = new Date(dto.hire_date);
    }

    if (dto.department !== undefined) {
      updateData.department = dto.department || null;
    }

    if (dto.job_title !== undefined) {
      updateData.jobTitle = dto.job_title || null;
    }

    const employee = await this.prisma.employee.update({
      where: { id },
      data: updateData,
    });

    // Auto-close open employment when terminating
    if (
      dto.status === 'TERMINATED' &&
      dto.termination_date &&
      employee.terminationDate
    ) {
      const openEmployment = await this.prisma.employment.findFirst({
        where: { employeeId: id, effectiveTo: null },
      });
      if (openEmployment) {
        await this.prisma.employment.update({
          where: { id: openEmployment.id },
          data: { effectiveTo: employee.terminationDate },
        });
      }
    }

    await this.auditService.log({
      userId,
      action: 'UPDATE',
      entityType: 'Employee',
      entityId: employee.id,
      oldValue: existing as any,
      newValue: employee as any,
      reason,
    });

    return this.mapToResponse(employee);
  }

  private mapToResponse(employee: any) {
    return {
      id: employee.id,
      employee_no: employee.employeeNo,
      first_name: employee.firstName,
      last_name: employee.lastName,
      national_id: employee.nationalId,
      email: employee.email,
      status: employee.status as EmployeeStatus,
      hire_date: employee.hireDate.toISOString().split('T')[0],
      termination_date: employee.terminationDate?.toISOString().split('T')[0] || null,
      department: employee.department || null,
      job_title: employee.jobTitle || null,
      manager_id: employee.managerId || null,
      manager_employee_no: employee.manager?.employeeNo || null,
      manager_name: employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`
        : null,
      created_at: employee.createdAt.toISOString(),
      updated_at: employee.updatedAt?.toISOString() || null,
    };
  }
}
