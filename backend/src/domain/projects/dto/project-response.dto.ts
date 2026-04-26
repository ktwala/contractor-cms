import { ApiProperty } from '@nestjs/swagger';

export class ProjectResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  clientName?: string;

  @ApiProperty({ required: false })
  startDate?: Date;

  @ApiProperty({ required: false })
  endDate?: Date;

  @ApiProperty({ required: false })
  budget?: number;

  @ApiProperty()
  currency: string;

  @ApiProperty({ required: false })
  costCenterId?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  _count?: {
    engagements: number;
    timesheets: number;
    tasks: number;
  };
}

export class PaginatedProjectResponseDto {
  @ApiProperty({ type: [ProjectResponseDto] })
  data: ProjectResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
