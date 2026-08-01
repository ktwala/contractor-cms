export class ImpactAnalysisRowDto {
  employeeId!: string;
  employeeNumber!: string | null;
  employeeName!: string | null;
  legalEntityName!: string | null;
  payGroupName!: string | null;

  taxableEarnings!: number;

  baselinePaye!: number;
  draftPaye!: number;
  deltaPaye!: number;
  absoluteDelta!: number;
  direction!: 'INCREASE' | 'DECREASE' | 'UNCHANGED';

  baselineBracketLabel!: string | null;
  draftBracketLabel!: string | null;
}

export class ImpactAnalysisSummaryDto {
  employeesAnalyzed!: number;
  employeesAffected!: number;
  employeesUnchanged!: number;
  employeesSkipped!: number;

  totalBaselinePaye!: number;
  totalDraftPaye!: number;
  totalPayeDelta!: number;

  averageDeltaAll!: number;
  averageDeltaAffected!: number;

  biggestIncrease!: { employeeId: string; amount: number } | null;
  biggestDecrease!: { employeeId: string; amount: number } | null;

  buckets!: Array<{ label: string; count: number }>;
  warnings!: string[];
}

export class ImpactAnalysisResponseDto {
  summary!: ImpactAnalysisSummaryDto;
  rows!: ImpactAnalysisRowDto[];
}
