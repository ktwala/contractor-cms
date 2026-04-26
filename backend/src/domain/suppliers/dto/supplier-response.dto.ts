import { ApiProperty } from '@nestjs/swagger';
import { SupplierType, SupplierStatus } from '@prisma/client';

export class SupplierResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty({ enum: SupplierType })
  type: SupplierType;

  @ApiProperty({ enum: SupplierStatus })
  status: SupplierStatus;

  @ApiProperty({ required: false })
  companyName?: string;

  @ApiProperty({ required: false })
  registrationNumber?: string;

  @ApiProperty({ required: false })
  vatNumber?: string;

  @ApiProperty({ required: false })
  firstName?: string;

  @ApiProperty({ required: false })
  lastName?: string;

  @ApiProperty({ required: false })
  idNumber?: string;

  @ApiProperty({ required: false })
  tradingName?: string;

  @ApiProperty()
  email: string;

  @ApiProperty({ required: false })
  phone?: string;

  @ApiProperty({ required: false })
  addressLine1?: string;

  @ApiProperty({ required: false })
  addressLine2?: string;

  @ApiProperty({ required: false })
  city?: string;

  @ApiProperty({ required: false })
  postalCode?: string;

  @ApiProperty()
  country: string;

  @ApiProperty({ required: false })
  bankName?: string;

  @ApiProperty({ required: false })
  bankAccountNumber?: string;

  @ApiProperty({ required: false })
  bankBranchCode?: string;

  @ApiProperty({ required: false })
  bankAccountType?: string;

  @ApiProperty({ required: false })
  taxNumber?: string;

  @ApiProperty({ required: false })
  taxClearanceExpiry?: Date;

  @ApiProperty({ required: false })
  bbbeeLevel?: string;

  @ApiProperty({ required: false })
  bbbeeExpiry?: Date;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PaginatedSupplierResponseDto {
  @ApiProperty({ type: [SupplierResponseDto] })
  data: SupplierResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
