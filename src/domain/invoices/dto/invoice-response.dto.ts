import { ApiProperty } from '@nestjs/swagger';
import { InvoiceStatus } from './update-invoice.dto';

export class InvoiceLineItemResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  invoiceId: string;

  @ApiProperty()
  description: string;

  @ApiProperty()
  quantity: number;

  @ApiProperty()
  unitPrice: number;

  @ApiProperty()
  amount: number;

  @ApiProperty({ required: false })
  projectId?: string;

  @ApiProperty({ required: false })
  costCenterId?: string;

  @ApiProperty({ required: false })
  glAccountCode?: string;

  @ApiProperty()
  createdAt: Date;
}

export class InvoiceResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  supplierId: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  invoiceNumber: string;

  @ApiProperty()
  invoiceDate: Date;

  @ApiProperty()
  dueDate: Date;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  subtotal: number;

  @ApiProperty()
  vatAmount: number;

  @ApiProperty()
  totalAmount: number;

  @ApiProperty({ enum: InvoiceStatus })
  status: string;

  @ApiProperty({ type: [InvoiceLineItemResponseDto] })
  lineItems: InvoiceLineItemResponseDto[];

  @ApiProperty({ required: false })
  submittedAt?: Date;

  @ApiProperty({ required: false })
  approvedAt?: Date;

  @ApiProperty({ required: false })
  approvedBy?: string;

  @ApiProperty({ required: false })
  rejectionReason?: string;

  @ApiProperty({ required: false })
  paidAt?: Date;

  @ApiProperty({ required: false })
  paymentReference?: string;

  @ApiProperty({ required: false })
  taxClassificationId?: string;

  @ApiProperty({ required: false })
  withholdingInstructionId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  supplier?: {
    id: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };

  @ApiProperty({ required: false })
  timesheets?: Array<{
    id: string;
    periodStart: Date;
    periodEnd: Date;
    totalHours: number;
  }>;
}

export class PaginatedInvoiceResponseDto {
  @ApiProperty({ type: [InvoiceResponseDto] })
  data: InvoiceResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
