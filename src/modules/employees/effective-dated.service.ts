import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CryptoService } from '../../common/services';
import { format, parseISO } from 'date-fns';
import {
  CreateCompensationDto,
  CreateBankAccountDto,
  CreateTaxProfileDto,
  CompensationResponseDto,
  BankAccountResponseDto,
  TaxProfileResponseDto,
} from './dto/effective-dated.dto';
import {
  CompensationHistoryResponseDto,
  BankAccountHistoryResponseDto,
  TaxProfileHistoryResponseDto,
} from './dto/employee-response.dto';
import { RecurringInputResponseDto } from './dto/effective-dated.dto';
import { Currency, Country, ResidencyStatus } from '../../common/dto/enums.dto';

@Injectable()
export class EffectiveDatedService {
  private readonly logger = new Logger(EffectiveDatedService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly cryptoService: CryptoService,
  ) {}

  /**
   * Get decrypted bank account number (with audit logging)
   *
   * SECURITY: This method logs all access to decrypted account numbers
   * Only use when absolutely necessary (e.g., bank file generation)
   *
   * @param bankAccountId - ID of the bank account
   * @param userId - ID of the user requesting decryption
   * @param reason - Reason for accessing the decrypted number
   * @returns Decrypted account number
   */
  async getDecryptedAccountNumber(
    bankAccountId: string,
    userId: string,
    reason: string,
  ): Promise<string> {
    const bankAccount = await this.prisma.bankAccount.findUnique({
      where: { id: bankAccountId },
      include: { employee: true },
    });

    if (!bankAccount) {
      throw new NotFoundException({
        code: 'BANK_ACCOUNT_NOT_FOUND',
        message: `Bank account with id '${bankAccountId}' not found`,
      });
    }

    // Decrypt the account number
    let decryptedNumber: string;
    try {
      decryptedNumber = this.cryptoService.decrypt(bankAccount.accountNumberEnc);
    } catch (error) {
      this.logger.error(
        `Failed to decrypt account number for bank account ${bankAccountId}: ${error.message}`,
      );
      throw new BadRequestException({
        code: 'DECRYPTION_FAILED',
        message: `Failed to decrypt bank account number: ${error.message}`,
        details: { bankAccountId },
      });
    }

    // CRITICAL: Audit log the decryption access
    await this.auditService.log({
      userId,
      action: 'DECRYPT_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: bankAccountId,
      newValue: {
        employeeId: bankAccount.employeeId,
        maskedNumber: bankAccount.maskedAccountNumber,
        // DO NOT log the actual account number!
      },
      reason,
    });

    this.logger.warn(
      `Bank account ${bankAccountId} decrypted by user ${userId}. Reason: ${reason}`,
    );

    return decryptedNumber;
  }

  async getCompensationHistory(employeeId: string): Promise<CompensationHistoryResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    const compensations = await this.prisma.compensation.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return {
      items: compensations.map((c) => ({
        id: c.id,
        employee_id: c.employeeId,
        base_salary: Number(c.baseSalary),
        currency: c.currency as Currency,
        effective_from: format(c.effectiveFrom, 'yyyy-MM-dd'),
        effective_to: c.effectiveTo ? format(c.effectiveTo, 'yyyy-MM-dd') : null,
        notes: c.notes || undefined,
        created_at: c.createdAt.toISOString(),
      })),
    };
  }

  async getCurrentCompensation(employeeId: string, asOfDate?: Date) {
    const date = asOfDate || new Date();

    return this.prisma.compensation.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getBankAccountHistory(employeeId: string): Promise<BankAccountHistoryResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    const bankAccounts = await this.prisma.bankAccount.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return {
      items: bankAccounts.map((ba) => ({
        id: ba.id,
        employee_id: ba.employeeId,
        bank_name: ba.bankName,
        masked_account_number: ba.maskedAccountNumber,
        branch_code: ba.branchCode || undefined,
        account_type: ba.accountType || undefined,
        effective_from: format(ba.effectiveFrom, 'yyyy-MM-dd'),
        effective_to: ba.effectiveTo ? format(ba.effectiveTo, 'yyyy-MM-dd') : null,
        created_at: ba.createdAt.toISOString(),
      })),
    };
  }

  async getCurrentBankAccount(employeeId: string, asOfDate?: Date) {
    const date = asOfDate || new Date();

    return this.prisma.bankAccount.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  async getTaxProfileHistory(employeeId: string): Promise<TaxProfileHistoryResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    const taxProfiles = await this.prisma.taxProfile.findMany({
      where: { employeeId },
      orderBy: { effectiveFrom: 'desc' },
    });

    return {
      items: taxProfiles.map((tp) => ({
        id: tp.id,
        employee_id: tp.employeeId,
        country: tp.country as Country,
        residency_status: tp.residencyStatus as ResidencyStatus,
        tin: tp.tin || undefined,
        effective_from: format(tp.effectiveFrom, 'yyyy-MM-dd'),
        effective_to: tp.effectiveTo ? format(tp.effectiveTo, 'yyyy-MM-dd') : null,
        created_at: tp.createdAt.toISOString(),
      })),
    };
  }

  async getCurrentTaxProfile(employeeId: string, asOfDate?: Date) {
    const date = asOfDate || new Date();

    return this.prisma.taxProfile.findFirst({
      where: {
        employeeId,
        effectiveFrom: { lte: date },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: date } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * Snapshot all effective-dated data for an employee at a specific date
   * Used during payrun snapshotting
   */
  async snapshotEmployeeData(employeeId: string, effectiveDate: Date) {
    if (!effectiveDate || isNaN(effectiveDate.getTime())) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_DATE',
        message: 'Invalid effective date provided for snapshot',
        details: { employeeId, effectiveDate: String(effectiveDate) },
      });
    }

    let employment, compensation, bankAccount, taxProfile;
    try {
      [employment, compensation, bankAccount, taxProfile] = await Promise.all([
        this.prisma.employment.findFirst({
          where: {
            employeeId,
            effectiveFrom: { lte: effectiveDate },
            OR: [
              { effectiveTo: null },
              { effectiveTo: { gte: effectiveDate } },
            ],
          },
          orderBy: { effectiveFrom: 'desc' },
          include: {
            legalEntity: true,
            payGroup: true,
          },
        }),
        this.getCurrentCompensation(employeeId, effectiveDate),
        this.getCurrentBankAccount(employeeId, effectiveDate),
        this.getCurrentTaxProfile(employeeId, effectiveDate),
      ]);
    } catch (error) {
      throw new BadRequestException({
        code: 'SNAPSHOT_DATA_RETRIEVAL_FAILED',
        message: `Failed to retrieve snapshot data for employee ${employeeId}: ${error.message}`,
        details: { employeeId, effectiveDate: format(effectiveDate, 'yyyy-MM-dd') },
      });
    }

    return {
      effective_date: format(effectiveDate, 'yyyy-MM-dd'),
      employee: { id: employeeId },
      employment: employment ? {
        id: employment.id,
        legal_entity_id: employment.legalEntityId,
        pay_group_id: employment.payGroupId,
        country: employment.country,
        job_title: employment.jobTitle,
        cost_center: employment.costCenter,
        employment_type: employment.employmentType,
      } : null,
      compensation: compensation ? {
        id: compensation.id,
        base_salary: Number(compensation.baseSalary),
        currency: compensation.currency as any as Currency,
      } : null,
      bank_account: bankAccount ? {
        id: bankAccount.id,
        bank_name: bankAccount.bankName,
        masked_account_number: bankAccount.maskedAccountNumber,
        branch_code: bankAccount.branchCode,
      } : null,
      tax_profile: taxProfile ? {
        id: taxProfile.id,
        country: taxProfile.country,
        residency_status: taxProfile.residencyStatus,
        tin: taxProfile.tin,
      } : null,
    };
  }

  // ============================================================================
  // CREATE METHODS
  // ============================================================================

  async createCompensation(
    employeeId: string,
    dto: CreateCompensationDto,
    userId?: string,
    reason?: string,
  ): Promise<CompensationResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    let effectiveFrom: Date;
    let effectiveTo: Date | null;

    try {
      effectiveFrom = parseISO(dto.effective_from);
      if (isNaN(effectiveFrom.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_FROM_DATE',
        message: `Invalid effective_from date: ${dto.effective_from}`,
        details: { providedDate: dto.effective_from },
      });
    }

    try {
      effectiveTo = dto.effective_to ? parseISO(dto.effective_to) : null;
      if (effectiveTo && isNaN(effectiveTo.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_TO_DATE',
        message: `Invalid effective_to date: ${dto.effective_to}`,
        details: { providedDate: dto.effective_to },
      });
    }

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'effective_to must be after effective_from',
        details: { effectiveFrom: dto.effective_from, effectiveTo: dto.effective_to },
      });
    }

    if (!dto.base_salary || dto.base_salary <= 0) {
      throw new BadRequestException({
        code: 'INVALID_BASE_SALARY',
        message: 'Base salary must be greater than zero',
        details: { baseSalary: dto.base_salary },
      });
    }

    // Close any existing open compensation record
    const existingOpen = await this.prisma.compensation.findFirst({
      where: {
        employeeId,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (existingOpen) {
      // Close the previous record day before new one starts
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);

      await this.prisma.compensation.update({
        where: { id: existingOpen.id },
        data: { effectiveTo: dayBefore },
      });
    }

    const compensation = await this.prisma.compensation.create({
      data: {
        employeeId,
        baseSalary: dto.base_salary,
        currency: dto.currency,
        effectiveFrom,
        effectiveTo,
        notes: dto.notes,
      },
    });

    if (userId) {
      await this.auditService.log({
        action: 'COMPENSATION_CREATED',
        entityType: 'compensation',
        entityId: compensation.id,
        userId,
        reason,
        newValue: { base_salary: dto.base_salary, currency: dto.currency },
      });
    }

    return {
      id: compensation.id,
      employee_id: compensation.employeeId,
      base_salary: Number(compensation.baseSalary),
      currency: compensation.currency as any as Currency,
      effective_from: format(compensation.effectiveFrom, 'yyyy-MM-dd'),
      effective_to: compensation.effectiveTo
        ? format(compensation.effectiveTo, 'yyyy-MM-dd')
        : null,
      notes: compensation.notes,
      created_at: compensation.createdAt.toISOString(),
    };
  }

  async createBankAccount(
    employeeId: string,
    dto: CreateBankAccountDto,
    userId?: string,
    reason?: string,
  ): Promise<BankAccountResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    let effectiveFrom: Date;
    let effectiveTo: Date | null;

    try {
      effectiveFrom = parseISO(dto.effective_from);
      if (isNaN(effectiveFrom.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_FROM_DATE',
        message: `Invalid effective_from date: ${dto.effective_from}`,
        details: { providedDate: dto.effective_from },
      });
    }

    try {
      effectiveTo = dto.effective_to ? parseISO(dto.effective_to) : null;
      if (effectiveTo && isNaN(effectiveTo.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_TO_DATE',
        message: `Invalid effective_to date: ${dto.effective_to}`,
        details: { providedDate: dto.effective_to },
      });
    }

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'effective_to must be after effective_from',
        details: { effectiveFrom: dto.effective_from, effectiveTo: dto.effective_to },
      });
    }

    // Validate account number
    if (!dto.account_number || dto.account_number.length < 4) {
      throw new BadRequestException({
        code: 'INVALID_ACCOUNT_NUMBER',
        message: 'Account number must be at least 4 characters',
        details: { accountNumberLength: dto.account_number?.length || 0 },
      });
    }

    // Mask account number (show last 4 digits)
    const maskedAccountNumber =
      '****' + dto.account_number.slice(-4);

    // Encrypt the account number using AES-256-GCM
    let accountNumberEnc: string;
    try {
      accountNumberEnc = this.cryptoService.encrypt(dto.account_number);
    } catch (error) {
      throw new BadRequestException({
        code: 'ENCRYPTION_FAILED',
        message: `Failed to encrypt bank account number: ${error.message}`,
        details: { employeeId },
      });
    }

    // Close any existing open bank account record
    const existingOpen = await this.prisma.bankAccount.findFirst({
      where: {
        employeeId,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (existingOpen) {
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);

      await this.prisma.bankAccount.update({
        where: { id: existingOpen.id },
        data: { effectiveTo: dayBefore },
      });
    }

    const bankAccount = await this.prisma.bankAccount.create({
      data: {
        employeeId,
        bankName: dto.bank_name,
        accountNumberEnc,
        maskedAccountNumber,
        branchCode: dto.branch_code,
        accountType: (dto.account_type || null) as any,
        effectiveFrom,
        effectiveTo,
      },
    });

    if (userId) {
      await this.auditService.log({
        action: 'BANK_ACCOUNT_CREATED',
        entityType: 'bank_account',
        entityId: bankAccount.id,
        userId,
        reason,
        newValue: { bank_name: dto.bank_name, masked_account: maskedAccountNumber },
      });
    }

    return {
      id: bankAccount.id,
      employee_id: bankAccount.employeeId,
      bank_name: bankAccount.bankName,
      masked_account_number: bankAccount.maskedAccountNumber,
      branch_code: bankAccount.branchCode || null,
      account_type: (bankAccount.accountType || null) as any,
      effective_from: format(bankAccount.effectiveFrom, 'yyyy-MM-dd'),
      effective_to: bankAccount.effectiveTo
        ? format(bankAccount.effectiveTo, 'yyyy-MM-dd')
        : null,
      created_at: bankAccount.createdAt.toISOString(),
    };
  }

  async createTaxProfile(
    employeeId: string,
    dto: CreateTaxProfileDto,
    userId?: string,
    reason?: string,
  ): Promise<TaxProfileResponseDto> {
    const employee = await this.prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      throw new NotFoundException({
        code: 'EMPLOYEE_NOT_FOUND',
        message: `Employee with id '${employeeId}' not found`,
      });
    }

    let effectiveFrom: Date;
    let effectiveTo: Date | null;

    try {
      effectiveFrom = parseISO(dto.effective_from);
      if (isNaN(effectiveFrom.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_FROM_DATE',
        message: `Invalid effective_from date: ${dto.effective_from}`,
        details: { providedDate: dto.effective_from },
      });
    }

    try {
      effectiveTo = dto.effective_to ? parseISO(dto.effective_to) : null;
      if (effectiveTo && isNaN(effectiveTo.getTime())) {
        throw new Error('Invalid date format');
      }
    } catch (error) {
      throw new BadRequestException({
        code: 'INVALID_EFFECTIVE_TO_DATE',
        message: `Invalid effective_to date: ${dto.effective_to}`,
        details: { providedDate: dto.effective_to },
      });
    }

    if (effectiveTo && effectiveTo <= effectiveFrom) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'effective_to must be after effective_from',
        details: { effectiveFrom: dto.effective_from, effectiveTo: dto.effective_to },
      });
    }

    // Close any existing open tax profile record for same country
    const existingOpen = await this.prisma.taxProfile.findFirst({
      where: {
        employeeId,
        country: dto.country,
        effectiveTo: null,
        effectiveFrom: { lt: effectiveFrom },
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (existingOpen) {
      const dayBefore = new Date(effectiveFrom);
      dayBefore.setDate(dayBefore.getDate() - 1);

      await this.prisma.taxProfile.update({
        where: { id: existingOpen.id },
        data: { effectiveTo: dayBefore },
      });
    }

    const taxProfile = await this.prisma.taxProfile.create({
      data: {
        employeeId,
        country: dto.country,
        residencyStatus: dto.residency_status as any,
        tin: dto.tin,
        effectiveFrom,
        effectiveTo,
      },
    });

    if (userId) {
      await this.auditService.log({
        action: 'TAX_PROFILE_CREATED',
        entityType: 'tax_profile',
        entityId: taxProfile.id,
        userId,
        reason,
        newValue: { country: dto.country, residency_status: dto.residency_status },
      });
    }

    return {
      id: taxProfile.id,
      employee_id: taxProfile.employeeId,
      country: taxProfile.country as any as Country,
      residency_status: taxProfile.residencyStatus as any as ResidencyStatus,
      tin: taxProfile.tin,
      effective_from: format(taxProfile.effectiveFrom, 'yyyy-MM-dd'),
      effective_to: taxProfile.effectiveTo
        ? format(taxProfile.effectiveTo, 'yyyy-MM-dd')
        : null,
      created_at: taxProfile.createdAt.toISOString(),
    };
  }
}
