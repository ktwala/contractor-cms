import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ChangeRequestKind, ChangeRequestStatus } from '../../../common/dto/enums.dto';

export class ChangeRequestResponseDto {
  @ApiProperty({ example: 'cr_123' })
  id: string;

  @ApiProperty({ example: 'emp_456' })
  employee_id: string;

  @ApiProperty({ enum: ChangeRequestKind })
  kind: ChangeRequestKind;

  @ApiProperty({ enum: ChangeRequestStatus })
  status: ChangeRequestStatus;

  @ApiProperty({
    example: {
      account_holder: 'John Doe',
      bank_name: 'Standard Bank',
      account_number: '1234567890',
    },
  })
  proposed_values: Record<string, any>;

  @ApiPropertyOptional({
    example: {
      account_holder: 'John Doe',
      bank_name: 'FNB',
      account_number: '0987654321',
    },
  })
  previous_values?: Record<string, any>;

  @ApiPropertyOptional({ example: '2026-02-01' })
  effective_date?: string;

  @ApiPropertyOptional({ example: 'Employee requested bank account change' })
  reason?: string;

  @ApiProperty({ example: 'user_789' })
  requested_by: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  requested_at: string;

  @ApiPropertyOptional({ example: 'user_101' })
  reviewed_by?: string;

  @ApiPropertyOptional({ example: '2026-01-16T14:00:00.000Z' })
  reviewed_at?: string;

  @ApiPropertyOptional({ example: 'Approved after verification' })
  review_comment?: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;

  @ApiProperty({ example: '2026-01-16T14:00:00.000Z' })
  updated_at: string;
}

export class ChangeRequestListResponseDto {
  @ApiProperty({ type: [ChangeRequestResponseDto] })
  data: ChangeRequestResponseDto[];

  @ApiProperty({
    example: {
      total: 100,
      page: 1,
      limit: 20,
      totalPages: 5,
    },
  })
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
