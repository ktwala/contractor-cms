import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto, InvoiceStatus } from './dto/update-invoice.dto';
import { QueryInvoiceDto } from './dto/query-invoice.dto';
import {
  PaginatedInvoiceResponseDto,
  InvoiceResponseDto,
} from './dto/invoice-response.dto';
import {
  GenerateInvoiceFromTimesheetsDto,
  MarkInvoicePaidDto,
} from './dto/generate-invoice.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    organizationId: string,
    createInvoiceDto: CreateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    // Verify supplier exists and belongs to organization
    const supplier = await this.prisma.supplier.findFirst({
      where: {
        id: createInvoiceDto.supplierId,
        organizationId,
      },
    });

    if (!supplier) {
      throw new NotFoundException('Supplier not found in your organization');
    }

    // Check for duplicate invoice number within organization
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        organizationId,
        invoiceNumber: createInvoiceDto.invoiceNumber,
      },
    });

    if (existingInvoice) {
      throw new ConflictException(
        'An invoice with this number already exists in your organization',
      );
    }

    // Validate dates
    const invoiceDate = new Date(createInvoiceDto.invoiceDate);
    const dueDate = new Date(createInvoiceDto.dueDate);
    const periodStart = new Date(createInvoiceDto.periodStart);
    const periodEnd = new Date(createInvoiceDto.periodEnd);

    if (dueDate <= invoiceDate) {
      throw new BadRequestException('Due date must be after invoice date');
    }

    if (periodEnd <= periodStart) {
      throw new BadRequestException('Period end must be after period start');
    }

    // Calculate line item amounts and totals
    const lineItems = createInvoiceDto.lineItems.map((item) => {
      const amount = item.quantity * item.unitPrice;
      return {
        ...item,
        quantity: new Decimal(item.quantity),
        unitPrice: new Decimal(item.unitPrice),
        amount: new Decimal(amount),
      };
    });

    const subtotal = lineItems.reduce(
      (sum, item) => sum.add(item.amount),
      new Decimal(0),
    );

    // Calculate VAT (15% for South Africa)
    const vatRate = 0.15;
    const vatAmount = subtotal.mul(vatRate);
    const totalAmount = subtotal.add(vatAmount);

    // Create invoice with line items
    const invoice = await this.prisma.invoice.create({
      data: {
        organizationId,
        supplierId: createInvoiceDto.supplierId,
        invoiceNumber: createInvoiceDto.invoiceNumber,
        invoiceDate,
        dueDate,
        periodStart,
        periodEnd,
        currency: createInvoiceDto.currency || 'ZAR',
        subtotal,
        vatAmount,
        totalAmount,
        status: 'DRAFT',
        taxClassificationId: createInvoiceDto.taxClassificationId,
        lineItems: {
          create: lineItems,
        },
        timesheets: createInvoiceDto.timesheetIds
          ? {
              connect: createInvoiceDto.timesheetIds.map((id) => ({ id })),
            }
          : undefined,
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    });

    return invoice as any;
  }

  async generateFromTimesheets(
    organizationId: string,
    dto: GenerateInvoiceFromTimesheetsDto,
  ): Promise<InvoiceResponseDto> {
    // Fetch all timesheets
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        id: { in: dto.timesheetIds },
        contractor: {
          supplier: {
            organizationId,
          },
        },
      },
      include: {
        contractor: {
          include: {
            supplier: true,
            engagements: {
              where: {
                isActive: true,
              },
              orderBy: {
                startDate: 'desc',
              },
              take: 1,
            },
          },
        },
        entries: true,
      },
    });

    if (timesheets.length === 0) {
      throw new NotFoundException('No timesheets found');
    }

    if (timesheets.length !== dto.timesheetIds.length) {
      throw new NotFoundException('Some timesheets were not found');
    }

    // Validate all timesheets are approved
    const unapprovedTimesheets = timesheets.filter(
      (ts) => ts.status !== 'APPROVED',
    );
    if (unapprovedTimesheets.length > 0) {
      throw new BadRequestException(
        'All timesheets must be approved before generating an invoice',
      );
    }

    // Validate all timesheets belong to the same contractor/supplier
    const supplierIds = [...new Set(timesheets.map((ts) => ts.contractor.supplierId))];
    if (supplierIds.length > 1) {
      throw new BadRequestException(
        'All timesheets must belong to the same supplier',
      );
    }

    const supplierId = supplierIds[0];

    // Calculate period range
    const allDates = timesheets.flatMap((ts) => [ts.periodStart, ts.periodEnd]);
    const periodStart = new Date(Math.min(...allDates.map((d) => d.getTime())));
    const periodEnd = new Date(Math.max(...allDates.map((d) => d.getTime())));

    // Create line items from timesheets
    const lineItems: any[] = [];

    for (const timesheet of timesheets) {
      const engagement = timesheet.contractor.engagements[0];
      if (!engagement) {
        throw new BadRequestException(
          `No active engagement found for contractor ${timesheet.contractor.firstName} ${timesheet.contractor.lastName}`,
        );
      }

      const totalHours = Number(timesheet.totalHours);
      let unitPrice = Number(engagement.rateAmount);
      let quantity = totalHours;
      let description = `${timesheet.contractor.firstName} ${timesheet.contractor.lastName} - ${engagement.role}`;

      // Adjust for rate type
      if (engagement.rateType === 'DAILY') {
        // Assume 8 hours per day
        quantity = totalHours / 8;
        description += ` (${totalHours} hours @ ${quantity.toFixed(2)} days)`;
      } else if (engagement.rateType === 'FIXED') {
        quantity = 1;
        description += ` (Fixed rate)`;
      } else {
        // HOURLY
        description += ` (${totalHours} hours)`;
      }

      lineItems.push({
        description,
        quantity,
        unitPrice,
        projectId: timesheet.projectId,
      });
    }

    // Create invoice using the create method
    return this.create(organizationId, {
      supplierId,
      invoiceNumber: dto.invoiceNumber,
      invoiceDate: dto.invoiceDate,
      dueDate: dto.dueDate,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      currency: dto.currency || 'ZAR',
      lineItems,
      timesheetIds: dto.timesheetIds,
      taxClassificationId: dto.taxClassificationId,
    });
  }

  async findAll(
    organizationId: string,
    query: QueryInvoiceDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    const {
      search,
      supplierId,
      status,
      periodStart,
      periodEnd,
      dueDateFrom,
      dueDateTo,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {
      organizationId,
    };

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        {
          supplier: {
            OR: [
              { companyName: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          },
        },
      ];
    }

    if (supplierId) {
      where.supplierId = supplierId;
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

    if (dueDateFrom) {
      where.dueDate = { ...where.dueDate, gte: new Date(dueDateFrom) };
    }

    if (dueDateTo) {
      where.dueDate = { ...where.dueDate, lte: new Date(dueDateTo) };
    }

    const [invoices, total] = await Promise.all([
      this.prisma.invoice.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          lineItems: true,
          supplier: {
            select: {
              id: true,
              companyName: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          timesheets: {
            select: {
              id: true,
              periodStart: true,
              periodEnd: true,
              totalHours: true,
            },
          },
        },
      }),
      this.prisma.invoice.count({ where }),
    ]);

    return {
      data: invoices as any,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return invoice as any;
  }

  async update(
    organizationId: string,
    id: string,
    updateInvoiceDto: UpdateInvoiceDto,
  ): Promise<InvoiceResponseDto> {
    // Check if invoice exists and belongs to organization
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lineItems: true,
      },
    });

    if (!existingInvoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only allow updates to DRAFT invoices
    if (existingInvoice.status !== 'DRAFT') {
      throw new BadRequestException(
        'Only draft invoices can be updated. Please create a new invoice.',
      );
    }

    // Check for invoice number conflict if number is being changed
    if (
      updateInvoiceDto.invoiceNumber &&
      updateInvoiceDto.invoiceNumber !== existingInvoice.invoiceNumber
    ) {
      const numberConflict = await this.prisma.invoice.findFirst({
        where: {
          organizationId,
          invoiceNumber: updateInvoiceDto.invoiceNumber,
          id: { not: id },
        },
      });

      if (numberConflict) {
        throw new ConflictException(
          'An invoice with this number already exists in your organization',
        );
      }
    }

    // Recalculate if line items changed
    let subtotal = existingInvoice.subtotal;
    let vatAmount = existingInvoice.vatAmount;
    let totalAmount = existingInvoice.totalAmount;

    if (updateInvoiceDto.lineItems) {
      // Delete existing line items
      await this.prisma.invoiceLineItem.deleteMany({
        where: { invoiceId: id },
      });

      // Calculate new amounts
      const lineItems = updateInvoiceDto.lineItems.map((item) => {
        const amount = item.quantity * item.unitPrice;
        return {
          ...item,
          quantity: new Decimal(item.quantity),
          unitPrice: new Decimal(item.unitPrice),
          amount: new Decimal(amount),
        };
      });

      subtotal = lineItems.reduce(
        (sum, item) => sum.add(item.amount),
        new Decimal(0),
      );

      const vatRate = 0.15;
      vatAmount = subtotal.mul(vatRate);
      totalAmount = subtotal.add(vatAmount);
    }

    const invoice = await this.prisma.invoice.update({
      where: { id },
      data: {
        invoiceNumber: updateInvoiceDto.invoiceNumber,
        invoiceDate: updateInvoiceDto.invoiceDate
          ? new Date(updateInvoiceDto.invoiceDate)
          : undefined,
        dueDate: updateInvoiceDto.dueDate
          ? new Date(updateInvoiceDto.dueDate)
          : undefined,
        periodStart: updateInvoiceDto.periodStart
          ? new Date(updateInvoiceDto.periodStart)
          : undefined,
        periodEnd: updateInvoiceDto.periodEnd
          ? new Date(updateInvoiceDto.periodEnd)
          : undefined,
        currency: updateInvoiceDto.currency,
        subtotal: updateInvoiceDto.lineItems ? subtotal : undefined,
        vatAmount: updateInvoiceDto.lineItems ? vatAmount : undefined,
        totalAmount: updateInvoiceDto.lineItems ? totalAmount : undefined,
        lineItems: updateInvoiceDto.lineItems
          ? {
              create: updateInvoiceDto.lineItems.map((item) => ({
                description: item.description,
                quantity: new Decimal(item.quantity),
                unitPrice: new Decimal(item.unitPrice),
                amount: new Decimal(item.quantity * item.unitPrice),
                projectId: item.projectId,
                costCenterId: item.costCenterId,
                glAccountCode: item.glAccountCode,
              })),
            }
          : undefined,
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    });

    return invoice as any;
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    // Only allow deletion of DRAFT or REJECTED invoices
    if (invoice.status !== 'DRAFT' && invoice.status !== 'REJECTED') {
      throw new BadRequestException(
        'Only draft or rejected invoices can be deleted',
      );
    }

    await this.prisma.invoice.delete({
      where: { id },
    });
  }

  async submit(organizationId: string, id: string): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
      include: {
        lineItems: true,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Only draft invoices can be submitted');
    }

    if (invoice.lineItems.length === 0) {
      throw new BadRequestException('Cannot submit invoice with no line items');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'SUBMITTED',
        submittedAt: new Date(),
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    }) as any;
  }

  async approve(
    organizationId: string,
    id: string,
    approvedBy: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted invoices can be approved');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy,
        rejectionReason: null,
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    }) as any;
  }

  async reject(
    organizationId: string,
    id: string,
    rejectionReason?: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'SUBMITTED') {
      throw new BadRequestException('Only submitted invoices can be rejected');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason || 'Rejected by approver',
        approvedAt: null,
        approvedBy: null,
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    }) as any;
  }

  async markPaid(
    organizationId: string,
    id: string,
    dto: MarkInvoicePaidDto,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status !== 'APPROVED') {
      throw new BadRequestException('Only approved invoices can be marked as paid');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'PAID',
        paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
        paymentReference: dto.paymentReference,
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    }) as any;
  }

  async cancel(organizationId: string, id: string): Promise<InvoiceResponseDto> {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        organizationId,
      },
    });

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    if (invoice.status === 'PAID') {
      throw new BadRequestException('Cannot cancel a paid invoice');
    }

    return this.prisma.invoice.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
      include: {
        lineItems: true,
        supplier: {
          select: {
            id: true,
            companyName: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        timesheets: {
          select: {
            id: true,
            periodStart: true,
            periodEnd: true,
            totalHours: true,
          },
        },
      },
    }) as any;
  }
}
