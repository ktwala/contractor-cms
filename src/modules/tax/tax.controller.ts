import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  UseGuards,
  Headers,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { TaxService, TaxBracket } from './tax.service';
import { TaxTableResponseDto, ImportTaxTableResponseDto } from './dto/tax-table-response.dto';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { CurrentUser, CurrentUserData } from '../../common/decorators/current-user.decorator';
import { ApiPayrollHeaders } from '../../common/decorators/api-headers.decorator';
import { Country } from '../../common/dto/enums.dto';

@ApiTags('Tax')
@ApiBearerAuth('bearerAuth')
@Controller('countries')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Post(':country/tax-tables/import')
  @Permissions('tax:write')
  @ApiOperation({ summary: 'Import PAYE tax tables for a country (CSV)' })
  @ApiParam({ name: 'country', enum: Country })
  @ApiPayrollHeaders()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'effective_from'],
      properties: {
        file: { type: 'string', format: 'binary' },
        effective_from: { type: 'string', format: 'date' },
        effective_to: { type: 'string', format: 'date', nullable: true },
        meta: { type: 'string', description: 'JSON string with country-specific metadata' },
      },
    },
  })
  @ApiResponse({ status: 202, description: 'Accepted', type: ImportTaxTableResponseDto })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 409, description: 'Conflict' })
  @UseInterceptors(FileInterceptor('file'))
  async importTaxTable(
    @Param('country') country: Country,
    @UploadedFile() file: Express.Multer.File,
    @Query('effective_from') effectiveFrom: string,
    @Query('effective_to') effectiveTo?: string,
    @Query('meta') metaJson?: string,
    @CurrentUser() user?: CurrentUserData,
    @Headers('x-reason') reason?: string,
  ): Promise<ImportTaxTableResponseDto> {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_REQUIRED',
        message: 'CSV file is required',
      });
    }

    if (!effectiveFrom) {
      throw new BadRequestException({
        code: 'EFFECTIVE_FROM_REQUIRED',
        message: 'effective_from date is required',
      });
    }

    // Parse CSV file
    const brackets = this.parseCSV(file.buffer.toString());
    const meta = metaJson ? JSON.parse(metaJson) : null;

    return this.taxService.importTaxTable(
      country,
      effectiveFrom,
      effectiveTo || null,
      brackets,
      meta,
      user?.sub,
      reason,
    );
  }

  @Get(':country/tax-tables')
  @Permissions('tax:read')
  @ApiOperation({ summary: 'Get tax table rows for a country effective date' })
  @ApiParam({ name: 'country', enum: Country })
  @ApiQuery({ name: 'effective_on', required: true, example: '2026-01-15' })
  @ApiResponse({ status: 200, description: 'OK', type: TaxTableResponseDto })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  async getTaxTable(
    @Param('country') country: Country,
    @Query('effective_on') effectiveOn: string,
  ): Promise<TaxTableResponseDto> {
    return this.taxService.getTaxTable(country, effectiveOn);
  }

  private parseCSV(content: string): TaxBracket[] {
    const lines = content.trim().split('\n');
    const brackets: TaxBracket[] = [];

    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.trim());

      if (parts.length < 3) continue;

      brackets.push({
        from_amount: parseFloat(parts[0]) || 0,
        to_amount: parts[1] ? (parseFloat(parts[1]) || null) : null,
        rate: parseFloat(parts[2]) || 0,
        base_tax: parts[3] ? (parseFloat(parts[3]) || null) : null,
      });
    }

    return brackets;
  }
}
