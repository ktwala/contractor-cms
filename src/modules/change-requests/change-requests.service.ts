import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CryptoService } from '../../common/services/crypto.service';
import { CreateChangeRequestDto } from './dto/create-change-request.dto';
import { ListChangeRequestsDto } from './dto/list-change-requests.dto';
import {
  ApproveChangeRequestDto,
  RejectChangeRequestDto,
  CancelChangeRequestDto,
} from './dto/review-change-request.dto';
import { ChangeRequestStatus, ChangeRequestKind } from '../../common/dto/enums.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ChangeRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
  ) {}

  async create(dto: CreateChangeRequestDto, requestedBy: string, requestContext: any) {
    // Verify employee exists
    const employee = await this.prisma.employee.findUnique({
      where: { id: dto.employee_id },
      // legalEntity not directly on Employee, use legalEntityId field
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${dto.employee_id} not found`);
    }

    // Get previous values based on change request kind
    const previousValues = await this.getPreviousValues(dto.employee_id, dto.kind);

    // Create the change request
    const changeRequest = await this.prisma.changeRequest.create({
      data: {
        subjectEntityType: 'Employee',
        subjectEntityId: dto.employee_id,
        kind: dto.kind,
        status: ChangeRequestStatus.SUBMITTED,
        payload: dto.proposed_values, // ChangeRequest uses 'payload' instead of 'proposed_values'
        // previous_values not in ChangeRequest model, store in payload if needed
        requestedEffectiveFrom: dto.effective_date ? new Date(dto.effective_date) : null,
        reason: dto.reason,
        createdBy: requestedBy,
        // requested_at not in ChangeRequest model
      },
    });

    // Audit log
    await this.auditService.log({
      userId: requestedBy,
      action: 'CHANGE_REQUEST_CREATED',
      entityType: 'ChangeRequest',
      entityId: changeRequest.id,
      newValue: changeRequest,
      reason: dto.reason,
      ipAddress: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return changeRequest;
  }

  async findAll(query: ListChangeRequestsDto) {
    const { employee_id, kind, status, requested_by, legal_entity_id, page = 1, limit = 20 } = query;

    const where: Prisma.ChangeRequestWhereInput = {};

    if (employee_id) {
    }

    if (kind) {
      where.kind = kind;
    }

    if (status) {
      where.status = status;
    }

    if (requested_by) {
      where.createdBy = requested_by;
    }

    if (legal_entity_id) {
      // Filter by legal entity - get employee IDs first
      const employees = await this.prisma.employee.findMany({
        where: {
          employments: {
            some: {
              legalEntityId: legal_entity_id,
              effectiveTo: null, // Current employment
            },
          },
        },
        select: { id: true },
      });
      const employeeIds = employees.map((e: { id: string }) => e.id);
      where.subjectEntityId = { in: employeeIds };
    }

    const [data, total] = await Promise.all([
      this.prisma.changeRequest.findMany({
        where,
        include: {
          employee: {
            select: {
              id: true,
              employeeNo: true,
              firstName: true,
              lastName: true,
              // legalEntityId not directly selectable, use include
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.changeRequest.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const changeRequest = await this.prisma.changeRequest.findUnique({
      where: { id },
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!changeRequest) {
      throw new NotFoundException(`Change request ${id} not found`);
    }

    return changeRequest;
  }

  async findPending(legalEntityId?: string) {
    const where: Prisma.ChangeRequestWhereInput = {
      status: ChangeRequestStatus.SUBMITTED,
    };

    if (legalEntityId) {
      where.subjectEntityId = {
        in: await this.prisma.employee.findMany({
          where: {
            employments: {
              some: {
                legalEntityId: legalEntityId,
                effectiveTo: null, // Current employment
              },
            },
          },
          select: { id: true },
        }).then(emps => emps.map(e => e.id)),
      };
    }

    return this.prisma.changeRequest.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeNo: true,
              firstName: true,
              lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async approve(id: string, dto: ApproveChangeRequestDto, reviewerId: string, requestContext: any) {
    const changeRequest = await this.findOne(id);

    // Validate status
    if (changeRequest.status !== ChangeRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Change request is ${changeRequest.status}, can only approve PENDING requests`,
      );
    }

    // Prevent self-approval
    if (changeRequest.createdBy === reviewerId) {
      throw new ForbiddenException('Cannot approve your own change request');
    }

    // Apply the change
    await this.applyChange(changeRequest);

    // Update the change request
    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.APPROVED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: dto.comment,
      },
    });

    // Audit log
    await this.auditService.log({
      userId: reviewerId,
      action: 'CHANGE_REQUEST_APPROVED',
      entityType: 'ChangeRequest',
      entityId: id,
      oldValue: { status: ChangeRequestStatus.SUBMITTED },
      newValue: { status: ChangeRequestStatus.APPROVED },
      reason: dto.comment,
      ipAddress: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return updated;
  }

  async reject(id: string, dto: RejectChangeRequestDto, reviewerId: string, requestContext: any) {
    const changeRequest = await this.findOne(id);

    // Validate status
    if (changeRequest.status !== ChangeRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Change request is ${changeRequest.status}, can only reject PENDING requests`,
      );
    }

    // Update the change request
    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.REJECTED,
        reviewedBy: reviewerId,
        reviewedAt: new Date(),
        reviewComment: dto.comment,
      },
    });

    // Audit log
    await this.auditService.log({
      userId: reviewerId,
      action: 'CHANGE_REQUEST_REJECTED',
      entityType: 'ChangeRequest',
      entityId: id,
      oldValue: { status: ChangeRequestStatus.SUBMITTED },
      newValue: { status: ChangeRequestStatus.REJECTED },
      reason: dto.comment,
      ipAddress: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return updated;
  }

  async cancel(id: string, dto: CancelChangeRequestDto, userId: string, requestContext: any) {
    const changeRequest = await this.findOne(id);

    // Validate status
    if (changeRequest.status !== ChangeRequestStatus.SUBMITTED) {
      throw new BadRequestException(
        `Change request is ${changeRequest.status}, can only cancel PENDING requests`,
      );
    }

    // Only the requester or an admin can cancel
    // For now, we allow the original requester
    if (changeRequest.createdBy !== userId) {
      throw new ForbiddenException('Only the requester can cancel this change request');
    }

    // Update the change request
    const updated = await this.prisma.changeRequest.update({
      where: { id },
      data: {
        status: ChangeRequestStatus.CANCELLED,
        reviewComment: dto.reason,
      },
    });

    // Audit log
    await this.auditService.log({
      userId,
      action: 'CHANGE_REQUEST_CANCELLED',
      entityType: 'ChangeRequest',
      entityId: id,
      oldValue: { status: ChangeRequestStatus.SUBMITTED },
      newValue: { status: ChangeRequestStatus.CANCELLED },
      reason: dto.reason,
      ipAddress: requestContext.ip,
      userAgent: requestContext.userAgent,
    });

    return updated;
  }

  private async getPreviousValues(
    employeeId: string,
    kind: ChangeRequestKind,
  ): Promise<Record<string, any> | null> {
    switch (kind) {
      case ChangeRequestKind.EMPLOYEE_BANK_ACCOUNT: {
        const bankAccount = await this.prisma.bankAccount.findFirst({
          where: {
            employeeId: employeeId,
            effectiveTo: null, // Current active record
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        return bankAccount
          ? {
              bank_name: bankAccount.bankName,
              account_number_masked: bankAccount.maskedAccountNumber,
              branch_code: bankAccount.branchCode,
              account_type: bankAccount.accountType,
            }
          : null;
      }

      case ChangeRequestKind.EMPLOYEE_COMPENSATION: {
        const compensation = await this.prisma.compensation.findFirst({
          where: {
            employeeId: employeeId,
            effectiveTo: null,
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        return compensation
          ? {
              baseSalary: compensation.baseSalary?.toString(),
              currency: compensation.currency,
              // pay_frequency not in Compensation model
            }
          : null;
      }

      case ChangeRequestKind.EMPLOYEE_TAX_PROFILE: {
        const taxProfile = await this.prisma.taxProfile.findFirst({
          where: {
            employeeId: employeeId,
            effectiveTo: null,
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        return taxProfile
          ? {
              tin: taxProfile.tin,
              residency_status: taxProfile.residencyStatus,
              // meta not in TaxProfile model
            }
          : null;
      }

      case ChangeRequestKind.OTHER: { // EMPLOYMENT not in enum, using OTHER
        const employment = await this.prisma.employment.findFirst({
          where: {
            employeeId: employeeId,
            effectiveTo: null,
          },
          orderBy: { effectiveFrom: 'desc' },
        });
        return employment
          ? {
              job_title: employment.jobTitle,
              cost_center: employment.costCenter,
              employment_type: employment.employmentType,
              // manager_id not in Employment model
            }
          : null;
      }

      default:
        return null;
    }
  }

  private async applyChange(changeRequest: any): Promise<void> {
    const { employee_id, kind, proposed_values, effective_date } = changeRequest;
    const effectiveFrom = effective_date || new Date();
    const employeeId = employee_id; // Use consistent variable name

    switch (kind) {
      case ChangeRequestKind.EMPLOYEE_BANK_ACCOUNT: {
        // End-date the current bank account
        await this.prisma.bankAccount.updateMany({
            where: {
              employeeId,
              effectiveTo: null,
            },
          data: {
            effectiveTo: effectiveFrom,
          },
        });

        // Encrypt the account number
        const accountNumber = proposed_values.account_number;
        if (!accountNumber) {
          throw new BadRequestException('Account number is required for bank account change');
        }

        const accountNumberEnc = this.cryptoService.encrypt(accountNumber);
        const maskedAccountNumber = accountNumber.length >= 4
          ? '*'.repeat(accountNumber.length - 4) + accountNumber.slice(-4)
          : '****';

        // Create new bank account record with encryption
        await this.prisma.bankAccount.create({
          data: {
            employeeId,
            // account_holder not in BankAccount model
            bankName: proposed_values.bank_name,
            accountNumberEnc: accountNumberEnc,
            maskedAccountNumber: maskedAccountNumber,
            branchCode: proposed_values.branch_code,
            accountType: proposed_values.account_type || 'CHECKING',
            effectiveFrom: effectiveFrom,
          },
        });
        break;
      }

      case ChangeRequestKind.EMPLOYEE_COMPENSATION: {
        // End-date the current compensation
        await this.prisma.compensation.updateMany({
            where: {
              employeeId,
              effectiveTo: null,
            },
          data: {
            effectiveTo: effectiveFrom,
          },
        });

        // Create new compensation record
        await this.prisma.compensation.create({
          data: {
            employeeId,
            baseSalary: proposed_values.base_salary,
            currency: proposed_values.currency || 'ZAR',
            // pay_frequency not in Compensation model
            effectiveFrom: effectiveFrom,
          },
        });
        break;
      }

      case ChangeRequestKind.EMPLOYEE_TAX_PROFILE: {
        // End-date the current tax profile
        await this.prisma.taxProfile.updateMany({
            where: {
              employeeId,
              effectiveTo: null,
            },
          data: {
            effectiveTo: effectiveFrom,
          },
        });

        // Create new tax profile record
        await this.prisma.taxProfile.create({
          data: {
            employeeId,
            country: proposed_values.country || 'ZA',
            tin: proposed_values.tax_number || proposed_values.tin || null,
            residencyStatus: proposed_values.tax_status || proposed_values.residency_status || 'RESIDENT',
            effectiveFrom: effectiveFrom,
          },
        });
        break;
      }

      case ChangeRequestKind.OTHER: { // EMPLOYMENT not in enum, using OTHER
        // End-date the current employment
        await this.prisma.employment.updateMany({
            where: {
              employeeId,
              effectiveTo: null,
            },
          data: {
            effectiveTo: effectiveFrom,
          },
        });

        // Create new employment record
        await this.prisma.employment.create({
          data: {
            employeeId,
            legalEntityId: proposed_values.legal_entity_id || (await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { employments: { where: { effectiveTo: null }, take: 1 } } }))?.employments[0]?.legalEntityId || '',
            payGroupId: proposed_values.pay_group_id || (await this.prisma.employee.findUnique({ where: { id: employeeId }, include: { employments: { where: { effectiveTo: null }, take: 1 } } }))?.employments[0]?.payGroupId || '',
            country: proposed_values.country || 'ZA',
            jobTitle: proposed_values.job_title,
            costCenter: proposed_values.department || proposed_values.cost_center,
            employmentType: proposed_values.employment_type || 'PERMANENT',
            effectiveFrom: effectiveFrom,
          },
        });
        break;
      }

      default:
        throw new BadRequestException(`Unsupported change request kind: ${kind}`);
    }
  }
}
