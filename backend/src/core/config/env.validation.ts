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

  /** PR-HCM-SPONSOR-BRIDGE-1 — when `true`, engagements enforce sponsor reference format (and stub existence). */
  @IsOptional()
  @IsString()
  HCM_SPONSOR_VALIDATION_ENABLED?: string;

  /** Optional regex (string) for `sponsorEmployeeId` / `sponsorDelegateEmployeeId` when validation enabled. */
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
