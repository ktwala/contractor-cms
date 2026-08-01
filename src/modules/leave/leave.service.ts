import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { LeavePackRegistry } from '../../country-packs/leave-pack.registry';
import { Decimal } from 'decimal.js';
import {
  LeaveTypeCode,
  LeaveRequestStatus,
  LeaveAccrualType,
  LeaveHalf,
  Country,
  CreateLeaveRequestDto,
  UpdateLeaveRequestDto,
  ReviewLeaveRequestDto,
  CancelLeaveRequestDto,
  AdjustBalanceDto,
  RunAccrualDto,
  CalculateWorkingDaysDto,
  LeaveBalanceResponseDto,
  LeaveRequestResponseDto,
  WorkingDaysResultDto,
  AccrualRunResultDto,
  TerminationPayoutResultDto,
  CalculateTerminationPayoutDto,
  LeaveCalendarQueryDto,
  LeaveCalendarResponseDto,
} from './dto/leave.dto';

@Injectable()
export class LeaveService {
  private readonly logger = new Logger(LeaveService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly leavePackRegistry: LeavePackRegistry,
  ) {}

  // ============================================================================
  // LEAVE TYPES
  // ============================================================================

  async getLeaveTypes(country: Country, organizationId?: string): Promise<any[]> {
    return this.prisma.leaveType.findMany({
      where: {
        country,
        isActive: true,
        OR: [
          { organizationId: null }, // System defaults
          { organizationId }, // Organization-specific
        ],
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async initializeLeaveTypesForCountry(
    country: Country,
    organizationId?: string,
  ): Promise<void> {
    const pack = this.leavePackRegistry.get(country);
    const config = pack.getLeaveConfig();

    for (const leaveType of config.leaveTypes) {
      await this.prisma.leaveType.upsert({
        where: {
          organizationId_country_code: {
            organizationId: organizationId || '',
            country,
            code: leaveType.code as LeaveTypeCode,
          },
        },
        update: {},
        create: {
          organizationId,
          country,
          code: leaveType.code as LeaveTypeCode,
          name: leaveType.name,
          description: leaveType.description,
          defaultEntitlement: leaveType.defaultEntitlement,
          entitlementUnit: leaveType.entitlementUnit,
          accrualRate: leaveType.accrualRate,
          accrualFrequency: leaveType.accrualFrequency,
          qualifyingMonths: leaveType.qualifyingMonths,
          cycleType: leaveType.cycleType,
          cycleLengthYears: leaveType.cycleLengthYears,
          allowCarryOver: leaveType.allowCarryOver,
          maxCarryOverDays: leaveType.maxCarryOverDays,
          carryOverExpiryMonths: leaveType.carryOverExpiryMonths,
          isPaid: leaveType.isPaid,
          paidPercentage: leaveType.paidPercentage,
          payoutOnTermination: leaveType.payoutOnTermination,
          requiresApproval: leaveType.requiresApproval,
          requiresCertificate: leaveType.requiresCertificate,
          certificateAfterDays: leaveType.certificateAfterDays,
          minNoticeDays: leaveType.minNoticeDays,
          maxConsecutiveDays: leaveType.maxConsecutiveDays,
          allowNegativeBalance: leaveType.allowNegativeBalance,
          maxNegativeDays: leaveType.maxNegativeDays,
          isStatutory: leaveType.isStatutory,
          sortOrder: leaveType.sortOrder,
        },
      });
    }

    this.logger.log(`Initialized leave types for ${country}`);
  }

  // ============================================================================
  // LEAVE BALANCES
  // ============================================================================

  async getEmployeeBalances(
    employeeId: string,
    asOfDate: Date = new Date(),
  ): Promise<LeaveBalanceResponseDto[]> {
    const employee = await this.getEmployeeWithContext(employeeId);
    const country = await this.getEmployeeCountry(employeeId);
    const pack = this.leavePackRegistry.get(country);

    const leaveTypes = await this.getLeaveTypes(country as Country);
    const balances: LeaveBalanceResponseDto[] = [];

    for (const leaveType of leaveTypes) {
      const cycleDates = pack.getCycleDates(
        leaveType.code,
        asOfDate,
        new Date(employee.hireDate),
      );

      let balance = await this.prisma.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_cycleStartDate: {
            employeeId,
            leaveTypeId: leaveType.id,
            cycleStartDate: cycleDates.startDate,
          },
        },
      });

      // Create balance record if it doesn't exist
      if (!balance) {
        balance = await this.createBalanceRecord(
          employeeId,
          leaveType.id,
          cycleDates.startDate,
          cycleDates.endDate,
        );
      }

      if (balance) {
        balances.push({
          id: balance.id,
          employeeId,
          leaveTypeId: leaveType.id,
          leaveTypeName: leaveType.name,
          leaveTypeCode: leaveType.code,
          cycleStartDate: cycleDates.startDate.toISOString(),
          cycleEndDate: cycleDates.endDate.toISOString(),
          openingBalance: Number(balance.openingBalance),
          accrued: Number(balance.accrued),
          taken: Number(balance.taken),
          pending: Number(balance.pending),
          adjustment: Number(balance.adjustment),
          forfeited: Number(balance.forfeited),
          encashed: Number(balance.encashed),
          currentBalance: Number(balance.currentBalance),
          availableBalance: Number(balance.availableBalance),
          carryOverBalance: Number(balance.carryOverBalance),
          carryOverExpiresAt: balance.carryOverExpiresAt?.toISOString(),
        });
      }
    }

    return balances;
  }

  async adjustBalance(dto: AdjustBalanceDto, adjustedBy: string): Promise<void> {
    const balance = await this.prisma.leaveBalance.findFirst({
      where: {
        employeeId: dto.employeeId,
        leaveTypeId: dto.leaveTypeId,
      },
      orderBy: { cycleStartDate: 'desc' },
    });

    if (!balance) {
      throw new NotFoundException('Leave balance not found');
    }

    const balanceBefore = Number(balance.currentBalance);
    const balanceAfter = balanceBefore + dto.adjustmentDays;

    await this.prisma.$transaction([
      // Create accrual record
      this.prisma.leaveAccrual.create({
        data: {
          employeeId: dto.employeeId,
          leaveTypeId: dto.leaveTypeId,
          accrualDate: new Date(),
          accrualType: dto.adjustmentType,
          amount: dto.adjustmentDays,
          balanceBefore,
          balanceAfter,
          reference: dto.reference,
          notes: dto.reason,
          createdBy: adjustedBy,
        },
      }),

      // Update balance
      this.prisma.leaveBalance.update({
        where: { id: balance.id },
        data: {
          adjustment: { increment: dto.adjustmentDays },
          currentBalance: balanceAfter,
          availableBalance: balanceAfter - Number(balance.pending),
        },
      }),
    ]);

    this.logger.log(
      `Adjusted leave balance for employee ${dto.employeeId}: ${dto.adjustmentDays} days`,
    );
  }

  private async createBalanceRecord(
    employeeId: string,
    leaveTypeId: string,
    cycleStartDate: Date,
    cycleEndDate: Date,
  ): Promise<any> {
    return this.prisma.leaveBalance.create({
      data: {
        employeeId,
        leaveTypeId,
        cycleStartDate,
        cycleEndDate,
        openingBalance: 0,
        accrued: 0,
        taken: 0,
        pending: 0,
        adjustment: 0,
        forfeited: 0,
        encashed: 0,
        currentBalance: 0,
        availableBalance: 0,
        carryOverBalance: 0,
      },
    });
  }

  // ============================================================================
  // LEAVE REQUESTS
  // ============================================================================

  async createLeaveRequest(
    employeeId: string,
    dto: CreateLeaveRequestDto,
    submittedBy: string,
  ): Promise<LeaveRequestResponseDto> {
    const employee = await this.getEmployeeWithContext(employeeId);
    const country = await this.getEmployeeCountry(employeeId);
    const pack = this.leavePackRegistry.get(country);

    const leaveType = await this.prisma.leaveType.findUnique({
      where: { id: dto.leaveTypeId },
    });

    if (!leaveType) {
      throw new NotFoundException('Leave type not found');
    }

    // Calculate working days
    const publicHolidays = pack.getPublicHolidays(new Date(dto.startDate).getFullYear());
    const workingDays = pack.calculateWorkingDays({
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      startHalf: dto.startHalf as 'FULL' | 'AM' | 'PM',
      endHalf: dto.endHalf as 'FULL' | 'AM' | 'PM',
      excludePublicHolidays: true,
      publicHolidays: publicHolidays.map((h) => h.date),
    });

    // Get current balance
    const balances = await this.getEmployeeBalances(employeeId, new Date(dto.startDate));
    const balance = balances.find((b) => b.leaveTypeId === dto.leaveTypeId);

    if (!balance) {
      throw new BadRequestException('Leave balance not found');
    }

    // Validate request
    const validation = pack.validateLeaveRequest({
      employee: {
        id: employee.id,
        hireDate: new Date(employee.hireDate),
        terminationDate: employee.terminationDate ? new Date(employee.terminationDate) : undefined,
        employmentType: 'PERMANENT', // TODO: Get from employment record
        country,
        monthlySalary: new Decimal(employee.compensations?.[0]?.baseSalary || 0),
        yearsOfService: this.calculateYearsOfService(new Date(employee.hireDate)),
      },
      leaveTypeCode: leaveType.code,
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      totalDays: workingDays.totalWorkingDays,
      currentBalance: balance.currentBalance,
      pendingDays: balance.pending,
    });

    if (!validation.isValid && !dto.allowNegativeBalance) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Create request
    const request = await this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        startHalf: dto.startHalf,
        endHalf: dto.endHalf,
        totalDays: workingDays.totalWorkingDays,
        reason: dto.reason,
        notes: dto.notes,
        certificateRequired: validation.requiresCertificate,
        status: leaveType.requiresApproval ? 'PENDING' : 'APPROVED',
        submittedBy,
      },
      include: {
        employee: true,
        leaveType: true,
      },
    });

    // Update pending balance
    await this.prisma.leaveBalance.updateMany({
      where: {
        employeeId,
        leaveTypeId: dto.leaveTypeId,
      },
      data: {
        pending: { increment: workingDays.totalWorkingDays },
        availableBalance: { decrement: workingDays.totalWorkingDays },
      },
    });

    return this.mapLeaveRequestToDto(request);
  }

  async reviewLeaveRequest(
    requestId: string,
    dto: ReviewLeaveRequestDto,
    reviewedBy: string,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: true, leaveType: true },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be reviewed');
    }

    const updatedRequest = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: dto.status,
        reviewedAt: new Date(),
        reviewedBy,
        reviewComment: dto.comment,
      },
      include: { employee: true, leaveType: true },
    });

    // If rejected, restore the pending balance
    if (dto.status === 'REJECTED') {
      await this.prisma.leaveBalance.updateMany({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
        },
        data: {
          pending: { decrement: Number(request.totalDays) },
          availableBalance: { increment: Number(request.totalDays) },
        },
      });
    }

    return this.mapLeaveRequestToDto(updatedRequest);
  }

  async cancelLeaveRequest(
    requestId: string,
    dto: CancelLeaveRequestDto,
    cancelledBy: string,
  ): Promise<LeaveRequestResponseDto> {
    const request = await this.prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { employee: true, leaveType: true },
    });

    if (!request) {
      throw new NotFoundException('Leave request not found');
    }

    if (!['PENDING', 'APPROVED'].includes(request.status)) {
      throw new BadRequestException('Only pending or approved requests can be cancelled');
    }

    const updatedRequest = await this.prisma.leaveRequest.update({
      where: { id: requestId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy,
        cancelReason: dto.reason,
      },
      include: { employee: true, leaveType: true },
    });

    // Restore balance
    if (request.status === 'APPROVED') {
      await this.prisma.leaveBalance.updateMany({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
        },
        data: {
          taken: { decrement: Number(request.totalDays) },
          currentBalance: { increment: Number(request.totalDays) },
          availableBalance: { increment: Number(request.totalDays) },
        },
      });
    } else {
      // Was pending
      await this.prisma.leaveBalance.updateMany({
        where: {
          employeeId: request.employeeId,
          leaveTypeId: request.leaveTypeId,
        },
        data: {
          pending: { decrement: Number(request.totalDays) },
          availableBalance: { increment: Number(request.totalDays) },
        },
      });
    }

    return this.mapLeaveRequestToDto(updatedRequest);
  }

  async getLeaveRequests(
    organizationId: string,
    filters: {
      employeeId?: string;
      leaveTypeId?: string;
      status?: LeaveRequestStatus;
      startDateFrom?: Date;
      startDateTo?: Date;
      page?: number;
      limit?: number;
    },
  ): Promise<{ requests: LeaveRequestResponseDto[]; total: number }> {
    const where: any = {};

    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.leaveTypeId) where.leaveTypeId = filters.leaveTypeId;
    if (filters.status) where.status = filters.status;
    if (filters.startDateFrom || filters.startDateTo) {
      where.startDate = {};
      if (filters.startDateFrom) where.startDate.gte = filters.startDateFrom;
      if (filters.startDateTo) where.startDate.lte = filters.startDateTo;
    }

    const [requests, total] = await Promise.all([
      this.prisma.leaveRequest.findMany({
        where,
        include: { employee: true, leaveType: true },
        orderBy: { createdAt: 'desc' },
        skip: ((filters.page || 1) - 1) * (filters.limit || 20),
        take: filters.limit || 20,
      }),
      this.prisma.leaveRequest.count({ where }),
    ]);

    return {
      requests: requests.map(this.mapLeaveRequestToDto),
      total,
    };
  }

  // ============================================================================
  // ACCRUALS
  // ============================================================================

  async runAccruals(
    organizationId: string,
    dto: RunAccrualDto,
    runBy: string,
  ): Promise<AccrualRunResultDto> {
    const accrualDate = new Date(dto.accrualDate);
    let employeesProcessed = 0;
    let accrualsCreated = 0;
    let totalDaysAccrued = 0;
    const errors: Array<{ employeeId: string; employeeName: string; error: string }> = [];

    // Get employees to process
    const employeeFilter: any = {};
    if (dto.employeeIds?.length) {
      employeeFilter.id = { in: dto.employeeIds };
    }

    const employees = await this.prisma.employee.findMany({
      where: {
        ...employeeFilter,
        status: 'ACTIVE',
      },
      include: {
        employments: {
          where: {
            effectiveFrom: { lte: accrualDate },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: accrualDate } }],
          },
        },
      },
    });

    for (const employee of employees) {
      try {
        const country = employee.employments[0]?.country || 'ZA';
        const pack = this.leavePackRegistry.get(country);

        // Get leave types to accrue
        const leaveTypes = await this.getLeaveTypes(country as Country, organizationId);
        const typesToProcess = dto.leaveTypeIds?.length
          ? leaveTypes.filter((lt: any) => dto.leaveTypeIds!.includes(lt.id))
          : leaveTypes;

        for (const leaveType of typesToProcess) {
          if (leaveType.accrualFrequency === 'NONE') continue;

          const cycleDates = pack.getCycleDates(
            leaveType.code,
            accrualDate,
            new Date(employee.hireDate),
          );

          // Get or create balance
          let balance = await this.prisma.leaveBalance.findUnique({
            where: {
              employeeId_leaveTypeId_cycleStartDate: {
                employeeId: employee.id,
                leaveTypeId: leaveType.id,
                cycleStartDate: cycleDates.startDate,
              },
            },
          });

          if (!balance) {
            balance = await this.createBalanceRecord(
              employee.id,
              leaveType.id,
              cycleDates.startDate,
              cycleDates.endDate,
            );
          }

          // Calculate accrual
          const accrualResult = pack.calculateAccrual({
            employee: {
              id: employee.id,
              hireDate: new Date(employee.hireDate),
              employmentType: 'PERMANENT',
              country,
              monthlySalary: new Decimal(0),
              yearsOfService: this.calculateYearsOfService(new Date(employee.hireDate)),
            },
            leaveTypeCode: leaveType.code,
            accrualDate,
            currentBalance: balance ? Number(balance.currentBalance) : 0,
            cycleStartDate: cycleDates.startDate,
          });

          if (accrualResult.accrualAmount > 0) {
            await this.prisma.$transaction([
              this.prisma.leaveAccrual.create({
                data: {
                  employeeId: employee.id,
                  leaveTypeId: leaveType.id,
                  accrualDate,
                  accrualType: 'MONTHLY',
                  amount: accrualResult.accrualAmount,
                    balanceBefore: balance ? Number(balance.currentBalance) : 0,
                    balanceAfter: accrualResult.newBalance,
                    payPeriodId: dto.payPeriodId,
                    createdBy: runBy,
                  },
                }),
                balance ? this.prisma.leaveBalance.update({
                  where: { id: balance.id },
                  data: {
                    accrued: { increment: accrualResult.accrualAmount },
                    currentBalance: accrualResult.newBalance,
                    availableBalance: accrualResult.newBalance - Number(balance.pending),
                  },
                }) : this.prisma.leaveBalance.create({
                  data: {
                    employeeId: employee.id,
                    leaveTypeId: leaveType.id,
                    cycleStartDate: cycleDates.startDate,
                    cycleEndDate: cycleDates.endDate,
                    openingBalance: 0,
                    accrued: accrualResult.accrualAmount,
                    taken: 0,
                    pending: 0,
                    adjustment: 0,
                    forfeited: 0,
                    encashed: 0,
                    currentBalance: accrualResult.newBalance,
                    availableBalance: accrualResult.newBalance,
                    carryOverBalance: 0,
                  },
                }),
            ]);

            accrualsCreated++;
            totalDaysAccrued += accrualResult.accrualAmount;
          }
        }

        employeesProcessed++;
      } catch (err) {
        errors.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          error: (err as Error).message,
        });
      }
    }

    return {
      accrualDate: accrualDate.toISOString(),
      employeesProcessed,
      accrualsCreated,
      totalDaysAccrued,
      errors,
    };
  }

  // ============================================================================
  // WORKING DAYS CALCULATION
  // ============================================================================

  async calculateWorkingDays(dto: CalculateWorkingDaysDto): Promise<WorkingDaysResultDto> {
    const pack = this.leavePackRegistry.get(dto.country);
    const year = new Date(dto.startDate).getFullYear();
    const publicHolidays = pack.getPublicHolidays(year);

    const result = pack.calculateWorkingDays({
      startDate: new Date(dto.startDate),
      endDate: new Date(dto.endDate),
      startHalf: dto.startHalf as 'FULL' | 'AM' | 'PM',
      endHalf: dto.endHalf as 'FULL' | 'AM' | 'PM',
      excludePublicHolidays: dto.excludePublicHolidays ?? true,
      publicHolidays: publicHolidays.map((h) => h.date),
    });

    // Find which holidays fall within the date range
    const holidaysInRange = publicHolidays.filter((h) => {
      const holidayDate = h.date.getTime();
      return (
        holidayDate >= new Date(dto.startDate).getTime() &&
        holidayDate <= new Date(dto.endDate).getTime()
      );
    });

    return {
      startDate: dto.startDate,
      endDate: dto.endDate,
      totalCalendarDays: result.totalCalendarDays,
      totalWorkingDays: result.totalWorkingDays,
      weekends: result.weekends,
      publicHolidays: result.publicHolidaysExcluded,
      publicHolidayDates: holidaysInRange.map((h) => ({
        date: h.date.toISOString().split('T')[0],
        name: h.name,
      })),
    };
  }

  // ============================================================================
  // TERMINATION PAYOUT
  // ============================================================================

  async calculateTerminationPayout(
    dto: CalculateTerminationPayoutDto,
  ): Promise<TerminationPayoutResultDto> {
    const employee = await this.getEmployeeWithContext(dto.employeeId);
    const country = await this.getEmployeeCountry(dto.employeeId);
    const pack = this.leavePackRegistry.get(country);

    const balances = await this.getEmployeeBalances(dto.employeeId, new Date(dto.terminationDate));

    const result = pack.calculateTerminationPayout({
      employee: {
        id: employee.id,
        hireDate: new Date(employee.hireDate),
        terminationDate: new Date(dto.terminationDate),
        employmentType: 'PERMANENT',
        country,
        monthlySalary: new Decimal(employee.compensations?.[0]?.baseSalary || 0),
        yearsOfService: this.calculateYearsOfService(new Date(employee.hireDate)),
      },
      terminationDate: new Date(dto.terminationDate),
      leaveBalances: balances.map((b) => ({
        leaveTypeCode: b.leaveTypeCode,
        balance: b.currentBalance,
      })),
    });

    return {
      employeeId: employee.id,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      terminationDate: dto.terminationDate,
      dailyRate: result.payouts[0]?.dailyRate || 0,
      payouts: result.payouts.map((p: any) => ({
        leaveTypeId: p.leaveTypeId || p.leaveTypeCode,
        leaveTypeName: p.leaveTypeName,
        balanceDays: p.balanceDays,
        payoutAmount: p.payoutAmount,
        isPayable: p.isPayable,
        reason: p.reason,
      })),
      totalPayoutDays: result.totalPayoutDays,
      totalPayoutAmount: result.totalPayoutAmount,
      forfeitedDays: result.forfeitedDays,
      forfeitedAmount: result.forfeitedAmount,
    };
  }

  // ============================================================================
  // PUBLIC HOLIDAYS
  // ============================================================================

  async getPublicHolidays(country: Country, year: number): Promise<any[]> {
    // First check database
    const dbHolidays = await this.prisma.publicHoliday.findMany({
      where: { country, year },
      orderBy: { date: 'asc' },
    });

    if (dbHolidays.length > 0) {
      return dbHolidays;
    }

    // Fall back to country pack
    const pack = this.leavePackRegistry.get(country);
    return pack.getPublicHolidays(year);
  }

  async seedPublicHolidays(country: Country, year: number): Promise<void> {
    const pack = this.leavePackRegistry.get(country);
    const holidays = pack.getPublicHolidays(year);

    for (const holiday of holidays) {
      await this.prisma.publicHoliday.upsert({
        where: {
          country_year_date: {
            country,
            year,
            date: holiday.date,
          },
        },
        update: {},
        create: {
          country,
          year,
          date: holiday.date,
          name: holiday.name,
          localName: holiday.localName,
          observedDate: (holiday as any).observedDate || null,
          isNational: holiday.isNational,
          region: holiday.region,
        },
      });
    }

    this.logger.log(`Seeded ${holidays.length} public holidays for ${country} ${year}`);
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private async getEmployeeWithContext(employeeId: string): Promise<any> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        employments: {
          where: {
            effectiveTo: null,
          },
          take: 1,
        },
        compensations: {
          where: {
            effectiveTo: null,
          },
          take: 1,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found');
    }

    return employee;
  }

  private async getEmployeeCountry(employeeId: string): Promise<string> {
    const employment = await this.prisma.employment.findFirst({
      where: {
        employeeId,
        effectiveTo: null,
      },
    });

    return employment?.country || 'ZA';
  }

  private calculateYearsOfService(hireDate: Date): number {
    const now = new Date();
    const years = now.getFullYear() - hireDate.getFullYear();
    const monthDiff = now.getMonth() - hireDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < hireDate.getDate())) {
      return years - 1;
    }

    return years;
  }

  private mapLeaveRequestToDto(request: any): LeaveRequestResponseDto {
    return {
      id: request.id,
      employeeId: request.employeeId,
      employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
      leaveTypeId: request.leaveTypeId,
      leaveTypeName: request.leaveType.name,
      leaveTypeCode: request.leaveType.code,
      startDate: request.startDate.toISOString(),
      endDate: request.endDate.toISOString(),
      startHalf: request.startHalf,
      endHalf: request.endHalf,
      totalDays: Number(request.totalDays),
      totalHours: request.totalHours ? Number(request.totalHours) : undefined,
      reason: request.reason,
      notes: request.notes,
      certificateRequired: request.certificateRequired,
      certificateUploaded: request.certificateUploaded,
      certificateUrl: request.certificateUrl,
      status: request.status,
      submittedAt: request.submittedAt.toISOString(),
      submittedBy: request.submittedBy,
      reviewedAt: request.reviewedAt?.toISOString(),
      reviewedBy: request.reviewedBy,
      reviewComment: request.reviewComment,
      cancelledAt: request.cancelledAt?.toISOString(),
      cancelledBy: request.cancelledBy,
      cancelReason: request.cancelReason,
      affectsPayroll: request.affectsPayroll,
      deductionAmount: request.deductionAmount ? Number(request.deductionAmount) : undefined,
      paidAmount: request.paidAmount ? Number(request.paidAmount) : undefined,
    };
  }
}
