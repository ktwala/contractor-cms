import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Country, EmploymentType } from '../../../common/dto/enums.dto';

export class EmploymentResponseDto {
  @ApiProperty({ example: 'empjob_1' })
  id: string;

  @ApiProperty({ example: 'emp_1' })
  employee_id: string;

  @ApiProperty({ example: 'le_za_001' })
  legal_entity_id: string;

  @ApiProperty({ example: 'pg_za_123' })
  pay_group_id: string;

  @ApiProperty({ enum: Country, example: Country.ZA })
  country: Country;

  @ApiPropertyOptional({ example: 'Software Engineer' })
  job_title?: string;

  @ApiPropertyOptional({ example: 'ENG-001' })
  cost_center?: string;

  @ApiProperty({ enum: EmploymentType, example: EmploymentType.PERMANENT })
  employment_type: EmploymentType;

  @ApiProperty({ example: '2024-01-15' })
  effective_from: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  effective_to?: string | null;

  @ApiPropertyOptional({
    description: 'Current assignment (org unit + cost center) effective as of today; null if none',
    example: {
      org_unit_id: 'ou_001',
      org_unit: { id: 'ou_001', code: 'PAYROLL', name: 'Payroll' },
      cost_center_id: 'cc_005',
      cost_center: { id: 'cc_005', code: 'CC100', name: 'Finance' },
      effective_from: '2025-01-01',
      effective_to: null,
    },
  })
  current_assignment?: {
    org_unit_id: string;
    org_unit: { id: string; code: string; name: string };
    cost_center_id: string | null;
    cost_center: { id: string; code: string; name: string } | null;
    effective_from: string;
    effective_to: string | null;
  } | null;

  @ApiPropertyOptional({
    description: 'Planned change: earliest future assignment (effective_from > today); null if none',
    example: {
      org_unit_id: 'ou_002',
      org_unit: { id: 'ou_002', code: 'PRODUCT', name: 'Product' },
      cost_center_id: 'cc_006',
      cost_center: { id: 'cc_006', code: 'CC200', name: 'Product Ops' },
      effective_from: '2025-04-01',
      effective_to: null,
    },
  })
  next_assignment?: {
    org_unit_id: string;
    org_unit: { id: string; code: string; name: string };
    cost_center_id: string | null;
    cost_center: { id: string; code: string; name: string } | null;
    effective_from: string;
    effective_to: string | null;
  } | null;

  @ApiPropertyOptional()
  notes?: string;

  @ApiProperty({ example: '2026-01-15T10:30:00.000Z' })
  created_at: string;
}

export class EmploymentHistoryResponseDto {
  @ApiProperty({ type: [EmploymentResponseDto] })
  items: EmploymentResponseDto[];
}
