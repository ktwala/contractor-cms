import { ApiProperty } from '@nestjs/swagger';
import { TimesheetStatus } from './query-timesheet.dto';

export class TimesheetEntryResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timesheetId: string;

  @ApiProperty()
  date: Date;

  @ApiProperty()
  hours: number;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty({ required: false })
  taskId?: string;

  @ApiProperty()
  createdAt: Date;
}

export class TimesheetResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  contractorId: string;

  @ApiProperty({ required: false })
  projectId?: string;

  @ApiProperty({ required: false })
  taskId?: string;

  @ApiProperty()
  periodStart: Date;

  @ApiProperty()
  periodEnd: Date;

  @ApiProperty({ type: [TimesheetEntryResponseDto] })
  entries: TimesheetEntryResponseDto[];

  @ApiProperty()
  totalHours: number;

  @ApiProperty({ required: false })
  totalAmount?: number;

  @ApiProperty({ enum: TimesheetStatus })
  status: string;

  @ApiProperty({ required: false })
  submittedAt?: Date;

  @ApiProperty({ required: false })
  approvedAt?: Date;

  @ApiProperty({ required: false })
  approvedBy?: string;

  @ApiProperty({ required: false })
  rejectionReason?: string;

  @ApiProperty({ required: false })
  invoiceId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  @ApiProperty({ required: false })
  contractor?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };

  @ApiProperty({ required: false })
  project?: {
    id: string;
    code: string;
    name: string;
  };
}

export class PaginatedTimesheetResponseDto {
  @ApiProperty({ type: [TimesheetResponseDto] })
  data: TimesheetResponseDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;

  @ApiProperty()
  totalPages: number;
}
