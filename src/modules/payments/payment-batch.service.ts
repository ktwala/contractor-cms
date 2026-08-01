import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { CreatePaymentBatchDto } from './dto/create-payment-batch.dto';
import { ListPaymentBatchesDto } from './dto/list-payment-batches.dto';
import { ConfirmPaymentBatchDto } from './dto/confirm-payment-batch.dto';
import { PayrunFinancialControlService } from '../payruns/payrun-financial-control.service';

@Injectable()
export class PaymentBatchService {
  private readonly logger = new Logger(PaymentBatchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => PayrunFinancialControlService))
    private readonly payrunFinancialControl: PayrunFinancialControlService,
  ) {}

  async listBatches(dto: ListPaymentBatchesDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 25;
    const where: any = {};

    if (dto.country) where.countryCode = dto.country;
    if (dto.legalEntityId) where.legalEntityId = dto.legalEntityId;
    if (dto.payGroupId) where.payGroupId = dto.payGroupId;
    if (dto.status) where.status = dto.status;
    if (dto.exportStatus) where.exportStatus = dto.exportStatus;
    if (dto.payrunId) where.payrunId = dto.payrunId;

    const [items, total] = await Promise.all([
      this.prisma.paymentBatch.findMany({
        where,
        include: {
          payrun: {
            select: {
              id: true,
              status: true,
              periodStart: true,
              periodEnd: true,
              payGroup: {
                select: {
                  name: true,
                  country: true,
                  legalEntityId: true,
                  legalEntity: { select: { name: true } },
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.paymentBatch.count({ where }),
    ]);

    const openBatches = await this.prisma.paymentBatch.count({
      where: { status: { notIn: ['CONFIRMED_PAID', 'PROCESSED', 'CANCELLED'] } },
    });
    const totalAmountPending = items
      .filter((b) => !['CONFIRMED_PAID', 'PROCESSED', 'CANCELLED'].includes(b.status))
      .reduce((sum, b) => sum + Number(b.totalAmount), 0);
    const confirmedPaidCount = await this.prisma.paymentBatch.count({
      where: { status: 'CONFIRMED_PAID' },
    });

    return {
      items: items.map((b) => this.mapBatchListItem(b)),
      summary: { openBatches, totalAmountPending, confirmedPaidCount },
      page,
      pageSize,
      total,
    };
  }

  async getBatch(id: string) {
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id },
      include: {
        payrun: {
          select: {
            id: true,
            status: true,
            periodStart: true,
            periodEnd: true,
            payGroup: {
              select: {
                name: true,
                country: true,
                legalEntityId: true,
                legalEntity: { select: { name: true } },
              },
            },
          },
        },
        payments: {
          select: {
            id: true,
            employeeId: true,
            amount: true,
            currency: true,
            bankName: true,
            accountNumber: true,
            status: true,
          },
        },
      },
    });

    if (!batch) throw new NotFoundException('Payment batch not found');

    return this.mapBatchDetail(batch);
  }

  async createBatch(dto: CreatePaymentBatchDto, actorUserId?: string) {
    const payrun: any = await this.prisma.payRun.findUnique({
      where: { id: dto.payrunId },
      include: {
        payGroup: {
          select: {
            id: true,
            name: true,
            country: true,
            legalEntityId: true,
            legalEntity: { select: { id: true, name: true } },
            currency: true,
          },
        },
        employeeResults: {
          select: {
            id: true,
            employeeId: true,
            net: true,
            employee: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                bankAccounts: {
                  where: { effectiveTo: null },
                  take: 1,
                  orderBy: { effectiveFrom: 'desc' as const },
                  select: {
                    bankName: true,
                    maskedAccountNumber: true,
                    branchCode: true,
                  },
                },
              },
            },
          },
        },
        paymentBatches: {
          where: { status: { notIn: ['CANCELLED', 'FAILED'] } },
          select: { id: true },
        },
      },
    });

    if (!payrun) throw new NotFoundException('Payrun not found');

    const blockers: { type: string; count?: number }[] = [];

    if (payrun.status !== 'APPROVED') {
      blockers.push({ type: 'PAYRUN_NOT_APPROVED' });
    }

    if (payrun.paymentBatches.length > 0) {
      blockers.push({ type: 'ACTIVE_BATCH_EXISTS' });
    }

    const paymentBlockerCount = await this.prisma.payrunException.count({
      where: {
        payrunId: dto.payrunId,
        blocksPayment: true,
        status: { in: ['OPEN', 'ASSIGNED'] },
      },
    });
    if (paymentBlockerCount > 0) {
      blockers.push({
        type: 'PAYMENT_BLOCKING_EXCEPTIONS_OPEN',
        count: paymentBlockerCount,
      });
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        error: 'invalid_state',
        message: 'Cannot create payment batch',
        blockers,
      });
    }

    const netAmount = payrun.employeeResults.reduce(
      (sum: number, r: any) => sum + Number(r.net ?? 0),
      0,
    );

    const pg = payrun.payGroup;
    const periodLabel = payrun.periodStart
      ? new Date(payrun.periodStart).toLocaleDateString('en-ZA', {
          month: 'short',
          year: 'numeric',
        })
      : 'BATCH';
    const batchCode = `${pg.country}-${pg.name.replace(/\s+/g, '-').toUpperCase()}-${periodLabel.replace(/\s+/g, '-').toUpperCase()}`;

    const batch = await this.prisma.paymentBatch.create({
      data: {
        organizationId: pg.legalEntityId,
        payrunId: dto.payrunId,
        reference: batchCode,
        bankFileFormat: 'EFT',
        status: 'READY',
        totalAmount: netAmount,
        paymentCount: payrun.employeeResults.length,
        countryCode: pg.country,
        legalEntityId: pg.legalEntityId,
        payGroupId: pg.id,
        currencyCode: pg.currency ?? 'ZAR',
        exportStatus: 'NOT_GENERATED',
      },
    });

    for (const result of payrun.employeeResults) {
      const emp = result.employee;
      const bank = emp?.bankAccounts?.[0];
      await this.prisma.payment.create({
        data: {
          batchId: batch.id,
          employeeId: result.employeeId,
          amount: Number(result.net ?? 0),
          currency: pg.currency ?? 'ZAR',
          reference: `${batchCode}-${result.employeeId.slice(-6)}`,
          bankName: bank?.bankName ?? null,
          accountNumber: bank?.maskedAccountNumber ?? null,
          branchCode: bank?.branchCode ?? null,
          status: 'PENDING',
        },
      });
    }

    await this.auditService.log({
      userId: actorUserId,
      action: 'PAYMENT_BATCH_CREATED',
      entityType: 'PaymentBatch',
      entityId: batch.id,
      newValue: {
        payrunId: dto.payrunId,
        batchCode,
        employeeCount: payrun.employeeResults.length,
        netAmount,
      },
    });

    this.logger.log(
      `Payment batch ${batch.id} created for payrun ${dto.payrunId}: ${payrun.employeeResults.length} employees, ${netAmount}`,
    );

    return this.getBatch(batch.id);
  }

  async exportBatch(id: string, actorUserId?: string) {
    const batch = await this.prisma.paymentBatch.findUnique({
      where: { id },
    });
    if (!batch) throw new NotFoundException('Payment batch not found');

    if (!['READY', 'PENDING'].includes(batch.status)) {
      throw new ConflictException({
        error: 'invalid_state',
        message: 'Batch must be in READY state to export',
        blockers: [{ type: 'INVALID_BATCH_STATUS' }],
      });
    }

    if (batch.payrunId) {
      const blockerCount = await this.prisma.payrunException.count({
        where: {
          payrunId: batch.payrunId,
          blocksPayment: true,
          status: { in: ['OPEN', 'ASSIGNED'] },
        },
      });
      if (blockerCount > 0) {
        throw new ConflictException({
          error: 'invalid_state',
          message: 'Cannot export: payment-blocking exceptions remain',
          blockers: [
            { type: 'PAYMENT_BLOCKING_EXCEPTIONS_OPEN', count: blockerCount },
          ],
        });
      }
    }

    await this.prisma.paymentBatch.update({
      where: { id },
      data: {
        status: 'GENERATED',
        exportStatus: 'GENERATED',
        exportGeneratedAt: new Date(),
        exportedByUserId: actorUserId,
      },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'PAYMENT_BATCH_EXPORTED',
      entityType: 'PaymentBatch',
      entityId: id,
      newValue: {
        payrunId: batch.payrunId,
        exportStatus: 'GENERATED',
      },
    });

    await this.payrunFinancialControl.reconcileAfterPaymentExport(id, actorUserId);

    return this.getBatch(id);
  }

  async confirmPaid(
    id: string,
    actorUserId?: string,
    dto?: ConfirmPaymentBatchDto,
  ) {
    const batch: any = await this.prisma.paymentBatch.findUnique({
      where: { id },
      include: {
        payrun: {
          select: {
            id: true,
            status: true,
            employeeResults: {
              select: { net: true },
            },
          },
        },
      },
    });
    if (!batch) throw new NotFoundException('Payment batch not found');

    const blockers: { type: string; count?: number; message?: string }[] = [];

    if (!['GENERATED', 'SUBMITTED', 'READY'].includes(batch.status)) {
      blockers.push({ type: 'INVALID_BATCH_STATUS' });
    }

    if (batch.payrun && batch.payrun.status !== 'APPROVED') {
      blockers.push({ type: 'PAYRUN_NOT_APPROVED' });
    }

    if (batch.payrunId) {
      const blockerCount = await this.prisma.payrunException.count({
        where: {
          payrunId: batch.payrunId,
          blocksPayment: true,
          status: { in: ['OPEN', 'ASSIGNED'] },
        },
      });
      if (blockerCount > 0) {
        blockers.push({
          type: 'PAYMENT_BLOCKING_EXCEPTIONS_OPEN',
          count: blockerCount,
        });
      }

      if (batch.payrun) {
        const payrunNet = batch.payrun.employeeResults.reduce(
          (s: number, r: any) => s + Number(r.net ?? 0),
          0,
        );
        if (Math.abs(payrunNet - Number(batch.totalAmount)) > 0.01) {
          blockers.push({
            type: 'BATCH_TOTAL_MISMATCH',
            message: `Payrun net ${payrunNet} != batch total ${batch.totalAmount}`,
          });
        }
      }
    }

    if (blockers.length > 0) {
      throw new ConflictException({
        error: 'invalid_state',
        message: 'Cannot confirm payment batch as paid',
        blockers,
      });
    }

    await this.prisma.paymentBatch.update({
      where: { id },
      data: {
        status: 'CONFIRMED_PAID',
        confirmedPaidAt: new Date(),
        confirmedPaidByUserId: actorUserId,
        confirmationNote: dto?.confirmationNote ?? null,
        processedAt: new Date(),
      },
    });

    await this.prisma.payment.updateMany({
      where: { batchId: id },
      data: { status: 'PAID' },
    });

    await this.auditService.log({
      userId: actorUserId,
      action: 'PAYMENT_BATCH_CONFIRMED_PAID',
      entityType: 'PaymentBatch',
      entityId: id,
      newValue: {
        payrunId: batch.payrunId,
        confirmationNote: dto?.confirmationNote,
        totalAmount: Number(batch.totalAmount),
        paymentCount: batch.paymentCount,
      },
    });

    return this.getBatch(id);
  }

  private mapBatchListItem(b: any) {
    const pg = b.payrun?.payGroup;
    return {
      id: b.id,
      batchCode: b.reference,
      payrunId: b.payrunId,
      payrunName: pg ? `${pg.name} ${this.periodLabel(b.payrun)}` : null,
      payrunStatus: b.payrun?.status ?? null,
      countryCode: b.countryCode ?? pg?.country ?? null,
      legalEntityName: pg?.legalEntity?.name ?? null,
      payGroupName: pg?.name ?? null,
      employeeCount: b.paymentCount,
      netAmount: Number(b.totalAmount),
      currencyCode: b.currencyCode ?? 'ZAR',
      status: b.status,
      exportStatus: b.exportStatus ?? 'NOT_GENERATED',
      confirmedPaidAt: b.confirmedPaidAt,
      updatedAt: b.updatedAt,
    };
  }

  private mapBatchDetail(b: any) {
    const pg = b.payrun?.payGroup;
    return {
      id: b.id,
      batchCode: b.reference,
      payrun: b.payrun
        ? {
            id: b.payrun.id,
            name: pg ? `${pg.name} ${this.periodLabel(b.payrun)}` : 'Payrun',
            status: b.payrun.status,
          }
        : null,
      countryCode: b.countryCode ?? pg?.country ?? null,
      legalEntityName: pg?.legalEntity?.name ?? null,
      payGroupName: pg?.name ?? null,
      currencyCode: b.currencyCode ?? 'ZAR',
      employeeCount: b.paymentCount,
      netAmount: Number(b.totalAmount),
      status: b.status,
      exportStatus: b.exportStatus ?? 'NOT_GENERATED',
      exportGeneratedAt: b.exportGeneratedAt,
      confirmedPaidAt: b.confirmedPaidAt,
      confirmedPaidByUserId: b.confirmedPaidByUserId,
      confirmationNote: b.confirmationNote,
      lines: (b.payments ?? []).map((p: any) => ({
        id: p.id,
        employeeId: p.employeeId,
        employeeName: null,
        bankName: p.bankName,
        accountNumberMasked: p.accountNumber
          ? `****${p.accountNumber.slice(-4)}`
          : null,
        amount: Number(p.amount),
        status: p.status,
      })),
    };
  }

  private periodLabel(payrun: any): string {
    if (!payrun?.periodStart) return '';
    return new Date(payrun.periodStart).toLocaleDateString('en-ZA', {
      month: 'short',
      year: 'numeric',
    });
  }
}
