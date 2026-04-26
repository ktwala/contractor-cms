import { ApiProperty } from '@nestjs/swagger';

export class OrganizationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  name: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  country: string;

  @ApiProperty()
  currency: string;

  @ApiProperty()
  timezone: string;

  @ApiProperty({ required: false })
  hcmType?: string;

  @ApiProperty({ required: false })
  hcmConfig?: Record<string, any>;

  @ApiProperty()
  isActive: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  _count?: {
    users: number;
    suppliers: number;
    contracts: number;
    invoices: number;
    projects: number;
  };
}
