import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ImpactAnalysisRunListItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  authoringVersionId!: string;

  @ApiProperty()
  countryCode!: string;

  @ApiProperty()
  basisMode!: string;

  @ApiPropertyOptional()
  payGroupId?: string | null;

  @ApiPropertyOptional()
  payrunId?: string | null;

  @ApiProperty()
  employeesAnalyzed!: number;

  @ApiProperty()
  employeesAffected!: number;

  @ApiProperty()
  employeesSkipped!: number;

  @ApiProperty()
  totalPayeDelta!: number;

  @ApiProperty()
  averageDeltaAffected!: number;

  @ApiPropertyOptional()
  latestReviewStatus?: string | null;

  @ApiPropertyOptional()
  latestReviewComment?: string | null;

  @ApiPropertyOptional()
  latestReviewedAt?: string | null;

  @ApiProperty()
  stale!: boolean;

  @ApiProperty()
  runAt!: string;
}

export class ImpactAnalysisPublishReadinessDto {
  @ApiProperty()
  allowed!: boolean;

  @ApiProperty()
  stale!: boolean;

  @ApiPropertyOptional()
  reason?: string | null;

  @ApiPropertyOptional()
  latestRunId?: string | null;

  @ApiPropertyOptional()
  latestReviewStatus?: string | null;
}
