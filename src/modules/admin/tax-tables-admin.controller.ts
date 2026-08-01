import {
    Controller,
    Get,
    Post,
    Put,
    Delete,
    Param,
    Body,
    Query,
    BadRequestException,
    UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../core/database/prisma.service';
import { Country, PackStatus, TaxTableType } from '@prisma/client';
import { AnyPermissions } from '../../common/decorators/permissions.decorator';
import { PermissionsGuard } from '../../common/guards/permissions.guard';

/**
 * Tax Tables Admin Controller (DEPRECATED for mutations)
 *
 * Read-only and preview operations remain active.
 * All CREATE / UPDATE / ACTIVATE / DELETE operations are now blocked.
 * Use the Tax Table Authoring workflow instead:
 *   POST /tax-table-authoring/versions/...  → draft → approve → publish
 *
 * @deprecated Mutation endpoints disabled — use Tax Table Authoring module.
 */

interface CreateTaxTableDto {
    country: 'ZA' | 'LS';
    tableType: 'PAYE' | 'UIF' | 'SDL' | 'MTC';
    taxYear: string;
    displayName?: string;
    effectiveFrom: string;
    effectiveTo?: string;
    sourceRef?: string;
    data: TaxTableData;
}

interface UpdateTaxTableDto {
    displayName?: string;
    effectiveFrom?: string;
    effectiveTo?: string;
    status?: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
    sourceRef?: string;
    data?: TaxTableData;
}

interface TaxTableData {
    brackets?: Array<{
        min: number;
        max: number | null;
        rate: number;
        base_amount: number;
    }>;
    credits?: { tax_credit?: number };
    rebates?: { primary?: number; secondary?: number; tertiary?: number };
    thresholds?: { under65?: number; age65to74?: number; age75plus?: number };
    periods_per_year?: Record<string, number>;
}

interface PreviewCalculationDto {
    taxTableId: string;
    monthlyIncome: number;
    employeeAge?: number;
    payPeriodType?: 'WEEKLY' | 'BI_WEEKLY' | 'SEMI_MONTHLY' | 'MONTHLY';
}

@ApiTags('Admin Tax Tables (legacy)')
@ApiBearerAuth('bearerAuth')
@Controller('admin/tax-tables')
@UseGuards(AuthGuard('jwt'), PermissionsGuard)
export class TaxTablesAdminController {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * List all tax tables with optional filters
     */
    @Get()
    @AnyPermissions('tax:read', 'tax_table_authoring_view')
    async listTaxTables(
        @Query('country') country?: string,
        @Query('tableType') tableType?: string,
        @Query('status') status?: string,
    ) {
        const where: any = {};
        if (country) where.country = country as Country;
        if (tableType) where.tableType = tableType as TaxTableType;
        if (status) where.status = status as PackStatus;

        const tables = await this.prisma.taxTableSet.findMany({
            where,
            orderBy: [{ country: 'asc' }, { effectiveFrom: 'desc' }],
        });

        return {
            success: true,
            data: tables.map((t) => ({
                id: t.id,
                country: t.country,
                tableType: t.tableType,
                taxYear: t.taxYear,
                displayName: t.displayName,
                effectiveFrom: t.effectiveFrom,
                effectiveTo: t.effectiveTo,
                status: t.status,
                sourceRef: t.sourceRef,
                checksum: t.checksum,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
            })),
        };
    }

    /**
     * List statutory configs (UIF, SDL, MTC)
     * Declared before the parameterized id route so paths are not captured as IDs.
     */
    @Get('statutory-configs/:country')
    @AnyPermissions('tax:read', 'tax_table_authoring_view')
    async listStatutoryConfigs(@Param('country') country: string) {
        const configs = await this.prisma.statutoryConfig.findMany({
            where: { country: country as Country },
            orderBy: { effectiveFrom: 'desc' },
        });

        return {
            success: true,
            data: configs.map((c) => ({
                id: c.id,
                country: c.country,
                configType: c.configType,
                effectiveFrom: c.effectiveFrom,
                effectiveTo: c.effectiveTo,
                status: c.status,
                data: c.data,
            })),
        };
    }

    /**
     * Preview tax calculation with a tax table
     */
    @Post('preview-calculation')
    @AnyPermissions('tax:read', 'tax_table_authoring_view')
    async previewCalculation(@Body() dto: PreviewCalculationDto) {
        const table = await this.prisma.taxTableSet.findUnique({ where: { id: dto.taxTableId } });

        if (!table) {
            throw new BadRequestException('Tax table not found');
        }

        const data = table.data as TaxTableData;
        const brackets = data.brackets || [];
        const periodsPerYear = dto.payPeriodType === 'MONTHLY' ? 12 : dto.payPeriodType === 'BI_WEEKLY' ? 26 : 52;
        const annualIncome = dto.monthlyIncome * 12;

        // Calculate tax using brackets
        let annualTax = 0;
        let bracketUsed: any = null;

        for (const bracket of brackets) {
            if (annualIncome > bracket.min) {
                bracketUsed = bracket;
                const max = bracket.max ?? Infinity;
                if (annualIncome <= max) {
                    annualTax = bracket.base_amount + (annualIncome - bracket.min) * bracket.rate;
                    break;
                }
            }
        }

        // Apply credits/rebates
        let taxAfterCredits = annualTax;

        if (table.country === 'LS' && data.credits?.tax_credit) {
            taxAfterCredits = Math.max(0, annualTax - data.credits.tax_credit);
        }

        if (table.country === 'ZA' && data.rebates) {
            const age = dto.employeeAge || 30;
            let rebate = data.rebates.primary || 0;
            if (age >= 65) rebate += data.rebates.secondary || 0;
            if (age >= 75) rebate += data.rebates.tertiary || 0;
            taxAfterCredits = Math.max(0, annualTax - rebate);
        }

        const monthlyPaye = Math.round((taxAfterCredits / 12) * 100) / 100;

        return {
            success: true,
            data: {
                input: {
                    monthlyIncome: dto.monthlyIncome,
                    annualIncome,
                    employeeAge: dto.employeeAge || 30,
                },
                calculation: {
                    bracketUsed,
                    annualTaxBeforeCredits: Math.round(annualTax * 100) / 100,
                    creditsApplied: table.country === 'LS' ? (data.credits?.tax_credit || 0) : 0,
                    rebatesApplied: table.country === 'ZA' ? (annualTax - taxAfterCredits) : 0,
                    annualTaxAfterCredits: Math.round(taxAfterCredits * 100) / 100,
                    monthlyPaye,
                },
                taxTable: {
                    id: table.id,
                    country: table.country,
                    taxYear: table.taxYear,
                    status: table.status,
                },
            },
        };
    }

    /**
     * Get a single tax table with full data
     */
    @Get(':id')
    @AnyPermissions('tax:read', 'tax_table_authoring_view')
    async getTaxTable(@Param('id') id: string) {
        const table = await this.prisma.taxTableSet.findUnique({ where: { id } });

        if (!table) {
            throw new BadRequestException('Tax table not found');
        }

        return {
            success: true,
            data: {
                id: table.id,
                country: table.country,
                tableType: table.tableType,
                taxYear: table.taxYear,
                displayName: table.displayName,
                effectiveFrom: table.effectiveFrom,
                effectiveTo: table.effectiveTo,
                status: table.status,
                sourceRef: table.sourceRef,
                checksum: table.checksum,
                data: table.data,
                createdAt: table.createdAt,
                updatedAt: table.updatedAt,
                createdBy: table.createdBy,
            },
        };
    }

    /**
     * @deprecated Use POST /tax-table-authoring/versions/manual or /from-template instead.
     */
    @Post()
    @AnyPermissions('tax:write', 'tax_table_authoring_edit')
    async createTaxTable(@Body() _dto: CreateTaxTableDto) {
        throw new BadRequestException({
            code: 'TTA_LEGACY_PATH_DISABLED',
            message: 'Direct tax table creation is disabled. Use the Tax Table Authoring workflow: POST /tax-table-authoring/versions/manual',
        });
    }

    /**
     * @deprecated Use PUT /tax-table-authoring/versions/:id/brackets or /fields instead.
     */
    @Put(':id')
    @AnyPermissions('tax:write', 'tax_table_authoring_edit')
    async updateTaxTable(@Param('id') _id: string, @Body() _dto: UpdateTaxTableDto) {
        throw new BadRequestException({
            code: 'TTA_LEGACY_PATH_DISABLED',
            message: 'Direct tax table updates are disabled. Use the Tax Table Authoring workflow: PUT /tax-table-authoring/versions/:id/brackets',
        });
    }

    /**
     * @deprecated Use POST /tax-table-authoring/versions/:id/publish instead.
     */
    @Post(':id/activate')
    @AnyPermissions('tax:write', 'tax_table_authoring_publish')
    async activateTaxTable(@Param('id') _id: string) {
        throw new BadRequestException({
            code: 'TTA_LEGACY_PATH_DISABLED',
            message: 'Direct tax table activation is disabled. Use the Tax Table Authoring publish workflow: POST /tax-table-authoring/versions/:id/publish',
        });
    }

    /**
     * @deprecated Use POST /tax-table-authoring/versions/:id/archive instead.
     */
    @Post(':id/deprecate')
    @AnyPermissions('tax:write', 'tax_table_authoring_archive')
    async deprecateTaxTable(@Param('id') _id: string) {
        throw new BadRequestException({
            code: 'TTA_LEGACY_PATH_DISABLED',
            message: 'Direct tax table deprecation is disabled. Use the Tax Table Authoring workflow.',
        });
    }

    /**
     * @deprecated Direct deletion is disabled. Archive authoring versions instead.
     */
    @Delete(':id')
    @AnyPermissions('tax:write', 'tax_table_authoring_archive')
    async deleteTaxTable(@Param('id') _id: string) {
        throw new BadRequestException({
            code: 'TTA_LEGACY_PATH_DISABLED',
            message: 'Direct tax table deletion is disabled. Use the Tax Table Authoring workflow.',
        });
    }
}
