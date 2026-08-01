import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsString, Min, Max, validateSync, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  NODE_ENV: Environment = Environment.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  @Type(() => Number)
  PORT: number = 3000;

  @IsString()
  API_PREFIX: string = 'api/v1';

  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  JWT_REFRESH_EXPIRES_IN: string = '7d';

  @IsString()
  API_KEY_SALT: string;

  @IsString()
  CORS_ORIGIN: string = 'http://localhost:3001';

  /**
   * PR-SPONSOR-REFERENCE-ONLY-1 — when `true`, CMS sponsor inbox + row scope (legacy Option B).
   * Default off: sponsor is HCM reference on engagement; IGA/workflow owns approvals.
   */
  @IsOptional()
  @IsString()
  RESPONSIBLE_MANAGER_ACCOUNTABILITY_INBOX_ENABLED?: string;

  /** PR-HCM-SPONSOR-BRIDGE-1 — when `true`, engagements enforce sponsor reference format (and stub existence). */
  @IsOptional()
  @IsString()
  HCM_SPONSOR_VALIDATION_ENABLED?: string;

  /** Optional regex (string) for `responsibleManagerEmployeeId` / `responsibleManagerDelegateEmployeeId` when validation enabled. */
  @IsOptional()
  @IsString()
  HCM_SPONSOR_REFERENCE_PATTERN?: string;

  /** PR-IGA-DISPATCH-SCHEDULER-1 — when `true`, interval worker calls `IgaOutboxDispatcherService.processPending`. */
  @IsOptional()
  @IsString()
  IGA_DISPATCH_ENABLED?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  IGA_DISPATCH_INTERVAL_SECONDS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  IGA_DISPATCH_BATCH_SIZE?: number;

  /** PR-CTR-4 — Oracle HCM REST extract (staging-only; disabled unless true). */
  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_ENABLED?: string;

  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_BASE_URL?: string;

  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_WORKERS_PATH?: string;

  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_USERNAME?: string;

  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_PASSWORD?: string;

  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_BEARER_TOKEN?: string;

  @IsOptional()
  @IsString()
  HCM_ORACLE_REST_PAGE_LIMIT?: string;

  /** PR-CMS-CONNECTOR-1A — Oracle Procurement REST supplier extract */
  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_ENABLED?: string;

  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_BASE_URL?: string;

  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_SUPPLIERS_PATH?: string;

  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_USERNAME?: string;

  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_PASSWORD?: string;

  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_BEARER_TOKEN?: string;

  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_REST_PAGE_LIMIT?: string;

  /** PR-CMS-CONNECTOR-1E — hours before connector is STALE (default 24) */
  @IsOptional()
  @IsString()
  ORACLE_PROCUREMENT_STALE_THRESHOLD_HOURS?: string;

  /** PR-CTR-CONNECTOR-1D — hours before HCM connector is STALE (default 24) */
  @IsOptional()
  @IsString()
  HCM_ORACLE_STALE_THRESHOLD_HOURS?: string;

  /** PR-DEMO-CONNECTOR-1 — expose demo sync controls in UI when true (non-production default). */
  @IsOptional()
  @IsString()
  DEMO_MODE?: string;

  /** PR-DEMO-CONNECTOR-1 — seed hidden HCM comparison anchors on reset:connector-demo (migration UAT only). */
  @IsOptional()
  @IsString()
  SEED_HCM_COMPARISON_ANCHORS?: string;
}

export function validateEnvironment(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  return validatedConfig;
}
