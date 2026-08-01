import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { InvoiceStatus } from '@prisma/client';

/** Operational invoice visibility for supplier portal (amounts redacted without finance grants). */
export class SupplierPortalInvoiceItemDto {
  @ApiProperty()
  id: string;

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

  @ApiProperty({ enum: InvoiceStatus })
  status: InvoiceStatus;

  @ApiProperty()
  currency: string;

  @ApiPropertyOptional({ nullable: true })
  subtotal: string | null;

  @ApiPropertyOptional({ nullable: true })
  vatAmount: string | null;

  @ApiPropertyOptional({ nullable: true })
  totalAmount: string | null;

  @ApiPropertyOptional({ nullable: true })
  submittedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  approvedAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paidAt: Date | null;

  @ApiPropertyOptional({ nullable: true })
  paymentReference: string | null;

  @ApiProperty({
    description: 'True when monetary or payment fields were withheld for this caller',
  })
  financialFieldsRestricted: boolean;
}
