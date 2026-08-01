import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../database/prisma.service';
import { COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX } from '../../domain/demo/connector-demo-comparison.constants';

const DEMO_ORG_CODE = 'DEMO';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  @Get('demo-config')
  @Public()
  @ApiOperation({ summary: 'Demo / UAT feature flags (non-sensitive)' })
  async demoConfig() {
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    const demoModeFlag = this.config.get<string>('DEMO_MODE') === 'true';
    const demoOrg = await this.prisma.organization.findUnique({
      where: { code: DEMO_ORG_CODE },
      select: { id: true },
    });
    const hcmComparisonAnchorsPresent = demoOrg
      ? (await this.prisma.contractor.count({
          where: {
            organizationId: demoOrg.id,
            email: { startsWith: COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX },
          },
        })) > 0
      : false;

    const procurementRestEnabled =
      this.config.get<string>('ORACLE_PROCUREMENT_REST_ENABLED') === 'true';
    const mockOracleBaseUrl = this.config.get<string>('ORACLE_PROCUREMENT_REST_BASE_URL');
    let mockOracleReachable: boolean | null = null;
    if (procurementRestEnabled && mockOracleBaseUrl?.includes('mock-oracle')) {
      try {
        const healthUrl = mockOracleBaseUrl.replace(
          /\/mock-oracle\/procurement\/?$/,
          '/health',
        );
        const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) });
        mockOracleReachable = response.ok;
      } catch {
        mockOracleReachable = false;
      }
    }

    return {
      demoModeEnabled: demoModeFlag || nodeEnv !== 'production',
      nodeEnv,
      hcmComparisonAnchorsPresent,
      oracleProcurementRestEnabled: procurementRestEnabled,
      hcmOracleRestEnabled:
        this.config.get<string>('HCM_ORACLE_REST_ENABLED') === 'true',
      mockOracleReachable,
    };
  }

  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Health check endpoint' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  check() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }

  @Get('liveness')
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('readiness')
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  @ApiResponse({ status: 503, description: 'Service is not ready' })
  readiness() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('database', this.prisma),
    ]);
  }
}
