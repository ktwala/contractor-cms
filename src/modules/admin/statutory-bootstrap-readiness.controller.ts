import { Controller, Get, Param, Query, BadRequestException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Country } from '@prisma/client';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { StatutoryBootstrapReadinessService } from '../statutory-readiness/statutory-bootstrap-readiness.service';

/**
 * Operator diagnostics: pack registry + PAYE + statutory rows effective on a date.
 * Aligns with PackRouterService resolution (snapshot minimum: active pack + active PAYE).
 */
@ApiTags('Admin Statutory Readiness')
@ApiBearerAuth('bearerAuth')
@Controller('admin/statutory-readiness')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class StatutoryBootstrapReadinessController {
  constructor(private readonly statutoryBootstrap: StatutoryBootstrapReadinessService) {}

  @Get(':country')
  @AnyPermissions('tax:read', 'tax_table_authoring_view')
  @ApiOperation({ summary: 'Bootstrap / snapshot readiness for a country (pack, PAYE, statutory)' })
  @ApiParam({ name: 'country', enum: ['ZA', 'LS'] })
  @ApiQuery({ name: 'as_of', required: false, description: 'ISO date (YYYY-MM-DD). Defaults to today (UTC).' })
  async getReadiness(@Param('country') countryParam: string, @Query('as_of') asOfRaw?: string) {
    const upper = countryParam.toUpperCase();
    if (upper !== 'ZA' && upper !== 'LS') {
      throw new BadRequestException('country must be ZA or LS');
    }
    const country = upper as Country;

    let asOf: Date;
    if (asOfRaw) {
      const d = new Date(`${asOfRaw}T12:00:00.000Z`);
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('as_of must be a valid YYYY-MM-DD date');
      }
      asOf = d;
    } else {
      asOf = new Date();
    }

    const data = await this.statutoryBootstrap.evaluate(country, asOf);
    return { success: true, data };
  }
}
