import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  SupplierSourceDriftSeverity,
  SupplierSourceDriftStatus,
  SupplierSourceDriftType,
  SupplierSourceSystem,
} from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class QuerySupplierSourceDriftDto {
  @ApiPropertyOptional({ enum: SupplierSourceDriftStatus })
  @IsOptional()
  @IsEnum(SupplierSourceDriftStatus)
  status?: SupplierSourceDriftStatus;

  @ApiPropertyOptional({ enum: SupplierSourceDriftSeverity })
  @IsOptional()
  @IsEnum(SupplierSourceDriftSeverity)
  severity?: SupplierSourceDriftSeverity;

  @ApiPropertyOptional({ enum: SupplierSourceDriftType })
  @IsOptional()
  @IsEnum(SupplierSourceDriftType)
  driftType?: SupplierSourceDriftType;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}

export class AssignSupplierSourceDriftDto {
  @ApiProperty()
  @IsUUID()
  assignedToUserId: string;
}

export class ResolveSupplierSourceDriftDto {
  @ApiProperty()
  @IsString()
  resolutionNotes: string;
}

export class SupplierSourceDriftItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  organizationId: string;

  @ApiPropertyOptional()
  supplierId: string | null;

  @ApiPropertyOptional()
  stagingId: string | null;

  @ApiProperty({ enum: SupplierSourceSystem })
  sourceSystem: SupplierSourceSystem;

  @ApiPropertyOptional()
  externalSupplierId: string | null;

  @ApiProperty({ enum: SupplierSourceDriftType })
  driftType: SupplierSourceDriftType;

  @ApiProperty({ enum: SupplierSourceDriftSeverity })
  severity: SupplierSourceDriftSeverity;

  @ApiProperty({ enum: SupplierSourceDriftStatus })
  status: SupplierSourceDriftStatus;

  @ApiProperty()
  detectedAt: string;

  @ApiPropertyOptional()
  classifiedAt: string | null;

  @ApiPropertyOptional()
  reviewedAt: string | null;

  @ApiPropertyOptional()
  resolvedAt: string | null;

  @ApiPropertyOptional()
  detectedByRunId: string | null;

  @ApiPropertyOptional()
  resolutionNotes: string | null;

  @ApiPropertyOptional()
  assignedToUserId: string | null;

  @ApiPropertyOptional({ description: 'Hours since detection (for aging panels)' })
  ageHours?: number;
}

export class PaginatedSupplierSourceDriftResponseDto {
  @ApiProperty({ type: [SupplierSourceDriftItemDto] })
  data: SupplierSourceDriftItemDto[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  page: number;

  @ApiProperty()
  limit: number;
}

export class SupplierSourceDriftSummaryDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  critical: number;

  @ApiProperty()
  high: number;

  @ApiProperty()
  medium: number;

  @ApiProperty()
  low: number;

  @ApiProperty()
  underReview: number;

  @ApiProperty()
  openTotal: number;

  @ApiProperty({
    description: 'Critical open drifts older than 72h',
  })
  criticalUnresolvedOver72h: number;

  @ApiProperty()
  evaluatedAt: string;
}

export class DetectSupplierSourceDriftResponseDto {
  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  detected: number;

  @ApiProperty()
  updated: number;

  @ApiProperty()
  evaluatedAt: string;

  @ApiPropertyOptional({
    example: 'SYNC-00015',
    description: 'Supplier sync snapshot assessed by this run',
  })
  syncSnapshotRef?: string;
}
