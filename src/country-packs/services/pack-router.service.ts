import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../core/database/prisma.service';
import { Country, PackStatus, TaxTableType } from '@prisma/client';

/**
 * Pack Router Service
 *
 * Deterministically selects {pack_version, tax_table_set} for any payrun.
 * Ensures reproducibility: same inputs → same routing decision → same output.
 *
 * IMPORTANT: All tax tables MUST be seeded in the database.
 * There are NO hardcoded fallbacks - this ensures all rates are auditable
 * and can be updated without code changes.
 *
 * Routing Rule: PAY_DATE (recommended)
 * - Uses payrun.pay_date as the compute_date
 * - Selects active pack/tables effective on that date
 */

export type ComputeDateRule = 'PAY_DATE' | 'PERIOD_END';

export interface RoutingInput {
  country: 'LS' | 'ZA';
  legal_entity_id: string;
  pay_date: string; // ISO date
  period_end: string; // ISO date
  run_type: 'REGULAR' | 'SUPPLEMENTAL' | 'ADJUSTMENT' | 'BONUS' | 'FINAL';
  compute_date_rule?: ComputeDateRule; // default: PAY_DATE
  override?: RoutingOverride; // Admin override (audited)
}

export interface RoutingOverride {
  pack_version?: string;
  tax_table_set_id?: string;
  reason: string; // Required for audit
}

export interface RoutingResult {
  compute_date_rule: ComputeDateRule;
  compute_date_value: string;
  pack: {
    id: string;
    version: string;
    checksum?: string;
  };
  tax_tables: {
    paye_table_set_id: string;
    checksum: string;
    data: TaxTableData;
  };
  statutory_configs?: {
    uif_config_id?: string;
    uif_data?: Record<string, any>;
    sdl_config_id?: string;
    sdl_data?: Record<string, any>;
    mtc_config_id?: string;
    mtc_data?: Record<string, any>;
  };
  checksums: Record<string, string>;
  overridden: boolean;
  override_reason?: string;
}

/**
 * Standardized routing result contract (TTA-PR-005).
 * Enriched version of RoutingResult that includes full tax table and
 * statutory config metadata for downstream snapshot/replay consumers.
 */
export interface ResolvedRoutingResult {
  countryCode: 'ZA' | 'LS';
  legalEntityId?: string | null;
  computeDate: string;
  runType: string;

  pack: {
    packCode: string;
    version: string;
    registryId: string;
    checksum?: string | null;
  };

  taxTableSet: {
    id: string;
    tableType: string;
    taxYear: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    status: 'ACTIVE';
    checksum?: string | null;
    sourceReference?: string | null;
  };

  statutoryConfigs: Array<{
    id: string;
    configType: string;
    effectiveFrom: string;
    effectiveTo?: string | null;
    checksum?: string | null;
  }>;

  checksums: Record<string, string>;
  overrides?: {
    packVersionPinned?: boolean;
    taxTableSetPinned?: boolean;
    reason?: string | null;
  };
}

export interface TaxTableData {
  brackets: Array<{
    min: number;
    max: number | null;
    rate: number;
    base_amount: number;
  }>;
  credits?: {
    tax_credit?: number;
  };
  rebates?: {
    primary?: number;
    secondary?: number;
    tertiary?: number;
  };
  thresholds?: {
    under65?: number;
    age65to74?: number;
    age75plus?: number;
  };
  periods_per_year?: Record<string, number>;
}

export interface PackRegistryEntry {
  id: string;
  country: string;
  pack_version: string;
  effective_from: Date;
  effective_to: Date | null;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  artifact_checksum?: string;
}

export interface TaxTableSetEntry {
  id: string;
  country: string;
  table_type: string;
  tax_year: string;
  effective_from: Date;
  effective_to: Date | null;
  status: 'DRAFT' | 'ACTIVE' | 'DEPRECATED';
  source_ref?: string;
  checksum: string;
  data: TaxTableData;
}

@Injectable()
export class PackRouterService {
  private readonly DEFAULT_COMPUTE_DATE_RULE: ComputeDateRule = 'PAY_DATE';

  constructor(private readonly prisma: PrismaService) { }

  /**
   * Resolve routing for a payrun
   * Returns deterministic selection of pack + tables + configs
   */
  async resolveRouting(input: RoutingInput): Promise<RoutingResult> {
    const computeDateRule = input.compute_date_rule || this.DEFAULT_COMPUTE_DATE_RULE;
    const computeDateValue = computeDateRule === 'PAY_DATE' ? input.pay_date : input.period_end;
    const computeDate = new Date(computeDateValue);

    // Handle override if provided (admin use only)
    if (input.override) {
      return this.resolveWithOverride(input, computeDateRule, computeDateValue);
    }

    // 1. Select active pack version for country + date
    const pack = await this.selectPack(input.country, computeDate);
    if (!pack) {
      throw new BadRequestException(
        `No active compute pack found for ${input.country} effective on ${computeDateValue}. ` +
        `Please seed the database with tax tables using: npx ts-node prisma/seeds/tax-tables.seed.ts`,
      );
    }

    // 2. Select active PAYE tax table set for country + date
    const payeTableSet = await this.selectTaxTableSet(input.country, 'PAYE', computeDate);
    if (!payeTableSet) {
      throw new BadRequestException(
        `No active PAYE tax table found for ${input.country} effective on ${computeDateValue}. ` +
        `Please seed the database with tax tables using: npx ts-node prisma/seeds/tax-tables.seed.ts`,
      );
    }

    // 3. Select optional statutory configs (UIF/SDL/MTC)
    const statutoryConfigs = await this.selectStatutoryConfigs(input.country, computeDate);

    // 4. Build checksums map for snapshot
    const checksums: Record<string, string> = {
      pack: pack.artifact_checksum || 'N/A',
      paye_tables: payeTableSet.checksum,
    };

    if (statutoryConfigs.uif_config_id) {
      checksums.uif_config = 'loaded';
    }

    return {
      compute_date_rule: computeDateRule,
      compute_date_value: computeDateValue,
      pack: {
        id: pack.id,
        version: pack.pack_version,
        checksum: pack.artifact_checksum,
      },
      tax_tables: {
        paye_table_set_id: payeTableSet.id,
        checksum: payeTableSet.checksum,
        data: payeTableSet.data,
      },
      statutory_configs: statutoryConfigs,
      checksums,
      overridden: false,
    };
  }

  /**
   * Enriched routing resolution that returns the standardized ResolvedRoutingResult.
   * Includes full tax table metadata for snapshot/replay consumers.
   */
  async resolveRoutingEnriched(input: RoutingInput): Promise<ResolvedRoutingResult> {
    const base = await this.resolveRouting(input);
    const computeDate = new Date(base.compute_date_value);

    const dbTableSet = await this.prisma.taxTableSet.findUnique({
      where: { id: base.tax_tables.paye_table_set_id },
    });

    const statutoryConfigEntries: ResolvedRoutingResult['statutoryConfigs'] = [];
    if (base.statutory_configs) {
      for (const [key, configId] of Object.entries(base.statutory_configs)) {
        if (!key.endsWith('_id') || !configId) continue;
        const cfg = await this.prisma.statutoryConfig.findUnique({
          where: { id: configId as string },
        });
        if (cfg) {
          statutoryConfigEntries.push({
            id: cfg.id,
            configType: cfg.configType,
            effectiveFrom: cfg.effectiveFrom.toISOString(),
            effectiveTo: cfg.effectiveTo?.toISOString(),
            checksum: cfg.checksum ?? undefined,
          });
        }
      }
    }

    return {
      countryCode: input.country,
      legalEntityId: input.legal_entity_id,
      computeDate: base.compute_date_value,
      runType: input.run_type,
      pack: {
        packCode: input.country,
        version: base.pack.version,
        registryId: base.pack.id,
        checksum: base.pack.checksum ?? null,
      },
      taxTableSet: {
        id: base.tax_tables.paye_table_set_id,
        tableType: dbTableSet?.tableType ?? 'PAYE',
        taxYear: dbTableSet?.taxYear ?? '',
        effectiveFrom: dbTableSet?.effectiveFrom?.toISOString() ?? '',
        effectiveTo: dbTableSet?.effectiveTo?.toISOString(),
        status: 'ACTIVE',
        checksum: base.tax_tables.checksum,
        sourceReference: dbTableSet?.sourceRef ?? null,
      },
      statutoryConfigs: statutoryConfigEntries,
      checksums: base.checksums,
      overrides: base.overridden
        ? {
            packVersionPinned: !!input.override?.pack_version,
            taxTableSetPinned: !!input.override?.tax_table_set_id,
            reason: base.override_reason ?? null,
          }
        : undefined,
    };
  }

  /**
   * Resolve with admin override (audited)
   */
  private async resolveWithOverride(
    input: RoutingInput,
    computeDateRule: ComputeDateRule,
    computeDateValue: string,
  ): Promise<RoutingResult> {
    const override = input.override!;
    const computeDate = new Date(computeDateValue);

    let pack: PackRegistryEntry | null = null;
    let payeTableSet: TaxTableSetEntry | null = null;

    if (override.pack_version) {
      pack = await this.getPackByVersion(input.country, override.pack_version);
      if (!pack) {
        throw new BadRequestException(`Pack version ${override.pack_version} not found`);
      }
    } else {
      pack = await this.selectPack(input.country, computeDate);
    }

    if (override.tax_table_set_id) {
      payeTableSet = await this.getTaxTableSetById(override.tax_table_set_id);
      if (!payeTableSet) {
        throw new BadRequestException(`Tax table set ${override.tax_table_set_id} not found`);
      }
    } else {
      payeTableSet = await this.selectTaxTableSet(input.country, 'PAYE', computeDate);
    }

    if (!pack || !payeTableSet) {
      throw new BadRequestException(
        'Unable to resolve routing. Ensure tax tables are seeded in the database.',
      );
    }

    const checksums: Record<string, string> = {
      pack: pack.artifact_checksum || 'N/A',
      paye_tables: payeTableSet.checksum,
    };

    return {
      compute_date_rule: computeDateRule,
      compute_date_value: computeDateValue,
      pack: {
        id: pack.id,
        version: pack.pack_version,
        checksum: pack.artifact_checksum,
      },
      tax_tables: {
        paye_table_set_id: payeTableSet.id,
        checksum: payeTableSet.checksum,
        data: payeTableSet.data,
      },
      checksums,
      overridden: true,
      override_reason: override.reason,
    };
  }

  /**
   * Select active pack from database (NO FALLBACK)
   */
  private async selectPack(country: string, computeDate: Date): Promise<PackRegistryEntry | null> {
    const dbPack = await this.prisma.packRegistry.findFirst({
      where: {
        country: country as Country,
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: computeDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: computeDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!dbPack) {
      return null;
    }

    return {
      id: dbPack.id,
      country: dbPack.country,
      pack_version: dbPack.packVersion,
      effective_from: dbPack.effectiveFrom,
      effective_to: dbPack.effectiveTo,
      status: dbPack.status as 'DRAFT' | 'ACTIVE' | 'DEPRECATED',
      artifact_checksum: dbPack.artifactChecksum || undefined,
    };
  }

  /**
   * Get specific pack by version from database
   */
  private async getPackByVersion(
    country: string,
    version: string,
  ): Promise<PackRegistryEntry | null> {
    const dbPack = await this.prisma.packRegistry.findFirst({
      where: {
        country: country as Country,
        packVersion: version,
      },
    });

    if (!dbPack) {
      return null;
    }

    return {
      id: dbPack.id,
      country: dbPack.country,
      pack_version: dbPack.packVersion,
      effective_from: dbPack.effectiveFrom,
      effective_to: dbPack.effectiveTo,
      status: dbPack.status as 'DRAFT' | 'ACTIVE' | 'DEPRECATED',
      artifact_checksum: dbPack.artifactChecksum || undefined,
    };
  }

  /**
   * Select active tax table set from database (NO FALLBACK)
   */
  private async selectTaxTableSet(
    country: string,
    tableType: string,
    computeDate: Date,
  ): Promise<TaxTableSetEntry | null> {
    const dbTableSet = await this.prisma.taxTableSet.findFirst({
      where: {
        country: country as Country,
        tableType: tableType as TaxTableType,
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: computeDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: computeDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (!dbTableSet) {
      return null;
    }

    return {
      id: dbTableSet.id,
      country: dbTableSet.country,
      table_type: dbTableSet.tableType,
      tax_year: dbTableSet.taxYear,
      effective_from: dbTableSet.effectiveFrom,
      effective_to: dbTableSet.effectiveTo,
      status: dbTableSet.status as 'DRAFT' | 'ACTIVE' | 'DEPRECATED',
      source_ref: dbTableSet.sourceRef || undefined,
      checksum: dbTableSet.checksum,
      data: dbTableSet.data as unknown as TaxTableData,
    };
  }

  /**
   * Get tax table set by ID from database
   */
  private async getTaxTableSetById(id: string): Promise<TaxTableSetEntry | null> {
    const dbTableSet = await this.prisma.taxTableSet.findUnique({
      where: { id },
    });

    if (!dbTableSet) {
      return null;
    }

    return {
      id: dbTableSet.id,
      country: dbTableSet.country,
      table_type: dbTableSet.tableType,
      tax_year: dbTableSet.taxYear,
      effective_from: dbTableSet.effectiveFrom,
      effective_to: dbTableSet.effectiveTo,
      status: dbTableSet.status as 'DRAFT' | 'ACTIVE' | 'DEPRECATED',
      source_ref: dbTableSet.sourceRef || undefined,
      checksum: dbTableSet.checksum,
      data: dbTableSet.data as unknown as TaxTableData,
    };
  }

  /**
   * Select statutory configs from database (NO FALLBACK)
   */
  private async selectStatutoryConfigs(
    country: string,
    computeDate: Date,
  ): Promise<{
    uif_config_id?: string;
    uif_data?: Record<string, any>;
    sdl_config_id?: string;
    sdl_data?: Record<string, any>;
    mtc_config_id?: string;
    mtc_data?: Record<string, any>;
  }> {
    const result: any = {};

    const uifConfig = await this.prisma.statutoryConfig.findFirst({
      where: {
        country: country as Country,
        configType: 'UIF',
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: computeDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: computeDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (uifConfig) {
      result.uif_config_id = uifConfig.id;
      result.uif_data = uifConfig.data as Record<string, any>;
    }

    const sdlConfig = await this.prisma.statutoryConfig.findFirst({
      where: {
        country: country as Country,
        configType: 'SDL',
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: computeDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: computeDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (sdlConfig) {
      result.sdl_config_id = sdlConfig.id;
      result.sdl_data = sdlConfig.data as Record<string, any>;
    }

    const mtcConfig = await this.prisma.statutoryConfig.findFirst({
      where: {
        country: country as Country,
        configType: 'MTC',
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: computeDate },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: computeDate } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });

    if (mtcConfig) {
      result.mtc_config_id = mtcConfig.id;
      result.mtc_data = mtcConfig.data as Record<string, any>;
    }

    return result;
  }

  /**
   * Load full tax table data for compute context
   */
  async loadTaxTableData(taxTableSetId: string): Promise<TaxTableSetEntry | null> {
    return this.getTaxTableSetById(taxTableSetId);
  }

  /**
   * Load statutory config data by ID
   */
  async loadStatutoryConfig(configId: string): Promise<Record<string, any> | null> {
    const config = await this.prisma.statutoryConfig.findUnique({
      where: { id: configId },
    });

    return config ? (config.data as Record<string, any>) : null;
  }

  /**
   * Verify routing hasn't changed (for audit/debug)
   */
  async verifyRouting(
    stored: RoutingResult,
    input: RoutingInput,
  ): Promise<{ matches: boolean; differences: string[] }> {
    const current = await this.resolveRouting(input);
    const differences: string[] = [];

    if (stored.pack.version !== current.pack.version) {
      differences.push(`pack_version: ${stored.pack.version} → ${current.pack.version}`);
    }

    if (stored.tax_tables.paye_table_set_id !== current.tax_tables.paye_table_set_id) {
      differences.push(
        `paye_table_set_id: ${stored.tax_tables.paye_table_set_id} → ${current.tax_tables.paye_table_set_id}`,
      );
    }

    if (stored.tax_tables.checksum !== current.tax_tables.checksum) {
      differences.push(
        `paye_checksum: ${stored.tax_tables.checksum} → ${current.tax_tables.checksum}`,
      );
    }

    return {
      matches: differences.length === 0,
      differences,
    };
  }

  /**
   * List all available tax table sets for a country
   */
  async listTaxTableSets(country: string): Promise<TaxTableSetEntry[]> {
    const dbTableSets = await this.prisma.taxTableSet.findMany({
      where: { country: country as Country },
      orderBy: [{ effectiveFrom: 'desc' }, { taxYear: 'desc' }],
    });

    return dbTableSets.map((ts) => ({
      id: ts.id,
      country: ts.country,
      table_type: ts.tableType,
      tax_year: ts.taxYear,
      effective_from: ts.effectiveFrom,
      effective_to: ts.effectiveTo,
      status: ts.status as 'DRAFT' | 'ACTIVE' | 'DEPRECATED',
      source_ref: ts.sourceRef || undefined,
      checksum: ts.checksum,
      data: ts.data as unknown as TaxTableData,
    }));
  }
}
