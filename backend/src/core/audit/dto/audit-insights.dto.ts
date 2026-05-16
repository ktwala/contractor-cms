import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsOptional, MaxDate, MinDate } from 'class-validator';

export class AuditInsightsQueryDto {
  @ApiPropertyOptional({ description: 'Start date for insights (max 30 days ago)' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startDate?: Date;

  @ApiPropertyOptional({ description: 'End date for insights' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endDate?: Date;
}

export class AdminSummaryDto {
  @ApiProperty()
  roleChangesLast24h: number;

  @ApiProperty()
  failedAdminActions: number;

  @ApiProperty()
  newUsersCreated: number;

  @ApiProperty()
  deactivatedUsers: number;

  @ApiProperty()
  auditExports: number;

  @ApiPropertyOptional()
  criticalAnomalies?: number;

  @ApiPropertyOptional()
  spoofAttempts?: number;
}

export class HighRiskEventDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  actor: any;

  @ApiProperty()
  action: string;

  @ApiProperty()
  target: any;

  @ApiProperty()
  riskLevel: string;

  @ApiPropertyOptional()
  reason?: string;
}

export class FailedActionDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  actor: any;

  @ApiProperty()
  action: string;

  @ApiProperty()
  target: any;

  @ApiPropertyOptional()
  reason?: string;
}

export class RoleChangeTimelineDto {
  @ApiProperty()
  targetUserId: string;

  @ApiProperty()
  targetUserEmail: string;

  @ApiProperty()
  changes: {
    action: string;
    roleName?: string;
    assignedBy: any;
    timestamp: Date;
  }[];
}

export class CrossOrgAttemptDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  timestamp: Date;

  @ApiProperty()
  actor: any;

  @ApiProperty()
  action: string;

  @ApiProperty()
  target: any;

  @ApiProperty()
  result: 'success' | 'failed';
}

export class AuditInsightsResponseDto {
  @ApiProperty({ type: AdminSummaryDto })
  summary: AdminSummaryDto;

  @ApiProperty({ type: [HighRiskEventDto] })
  highRiskEvents: HighRiskEventDto[];

  @ApiProperty({ type: [FailedActionDto] })
  failedActions: FailedActionDto[];

  @ApiProperty({ type: [RoleChangeTimelineDto] })
  roleChangeTimeline: RoleChangeTimelineDto[];

  @ApiProperty({ type: [CrossOrgAttemptDto] })
  crossOrgAttempts: CrossOrgAttemptDto[];

  @ApiPropertyOptional({ type: [HighRiskEventDto] })
  anomalies?: HighRiskEventDto[];
}
