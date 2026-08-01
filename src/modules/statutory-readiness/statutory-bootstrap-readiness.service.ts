import { Injectable } from '@nestjs/common';
import { Country, PackStatus, TaxTableType } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';

/** Inner payload returned by evaluate; mirrors admin statutory-readiness API `data`. */
export interface StatutoryBootstrapEvaluationData {
  country: Country;
  as_of: string;
  pack_registry: {
    ready: boolean;
    rows: Array<{
      id: string;
      packVersion: string;
      displayName: string | null;
      effectiveFrom: string;
      effectiveTo: string | null;
      status: string;
      artifactChecksum: string | null;
    }>;
  };
  paye_tax_table: {
    ready: boolean;
    rows: Array<{
      id: string;
      taxYear: string;
      displayName: string | null;
      effectiveFrom: string;
      effectiveTo: string | null;
      status: string;
      checksum: string | null;
    }>;
  };
  statutory_configs: {
    ready: boolean;
    expected_types: string[];
    checks: Array<{ configType: string; ready: boolean; id: string | null }>;
  };
  readiness: {
    snapshot_engine_ready: boolean;
    operator_bootstrap_complete: boolean;
  };
  notes: {
    rbac_vs_statutory: string;
    tta_vs_pack_registry: string;
  };
}

@Injectable()
export class StatutoryBootstrapReadinessService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Pack registry + PAYE + (ZA) statutory rows effective on `asOf`.
   * Only ZA and LS are supported for snapshot routing in this product slice.
   */
  async evaluate(country: Country, asOf: Date): Promise<StatutoryBootstrapEvaluationData> {
    const packRows = await this.prisma.packRegistry.findMany({
      where: {
        country,
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      take: 5,
      select: {
        id: true,
        packVersion: true,
        displayName: true,
        effectiveFrom: true,
        effectiveTo: true,
        status: true,
        artifactChecksum: true,
      },
    });

    const payeRows = await this.prisma.taxTableSet.findMany({
      where: {
        country,
        tableType: TaxTableType.PAYE,
        status: PackStatus.ACTIVE,
        effectiveFrom: { lte: asOf },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
      },
      orderBy: { effectiveFrom: 'desc' },
      take: 5,
      select: {
        id: true,
        taxYear: true,
        displayName: true,
        effectiveFrom: true,
        effectiveTo: true,
        status: true,
        checksum: true,
      },
    });

    const expectedStatutoryTypes = country === Country.ZA ? (['UIF', 'SDL', 'MTC'] as const) : ([] as const);

    const statutoryChecks: Array<{
      configType: string;
      ready: boolean;
      row: { id: string; effectiveFrom: Date; effectiveTo: Date | null; status: string } | null;
    }> = [];

    for (const configType of expectedStatutoryTypes) {
      const row = await this.prisma.statutoryConfig.findFirst({
        where: {
          country,
          configType,
          status: PackStatus.ACTIVE,
          effectiveFrom: { lte: asOf },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: asOf } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        select: { id: true, effectiveFrom: true, effectiveTo: true, status: true },
      });
      statutoryChecks.push({ configType, ready: !!row, row });
    }

    const packReady = packRows.length > 0;
    const payeReady = payeRows.length > 0;
    const statutoryReady =
      expectedStatutoryTypes.length === 0 ? true : statutoryChecks.every((s) => s.ready);

    const snapshotEngineReady = packReady && payeReady;
    const operatorBootstrapComplete =
      country === Country.ZA ? snapshotEngineReady && statutoryReady : snapshotEngineReady;

    return {
      country,
      as_of: asOf.toISOString().slice(0, 10),
      pack_registry: {
        ready: packReady,
        rows: packRows.map((p) => ({
          ...p,
          effectiveFrom: p.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: p.effectiveTo?.toISOString().slice(0, 10) ?? null,
        })),
      },
      paye_tax_table: {
        ready: payeReady,
        rows: payeRows.map((t) => ({
          ...t,
          effectiveFrom: t.effectiveFrom.toISOString().slice(0, 10),
          effectiveTo: t.effectiveTo?.toISOString().slice(0, 10) ?? null,
        })),
      },
      statutory_configs: {
        ready: statutoryReady,
        expected_types: [...expectedStatutoryTypes],
        checks: statutoryChecks.map((s) => ({
          configType: s.configType,
          ready: s.ready,
          id: s.row?.id ?? null,
        })),
      },
      readiness: {
        snapshot_engine_ready: snapshotEngineReady,
        operator_bootstrap_complete: operatorBootstrapComplete,
      },
      notes: {
        rbac_vs_statutory:
          'RBAC (prisma/seed.ts role permissions) is separate from country statutory bootstrap (prisma/seeds/tax-tables.seed.ts).',
        tta_vs_pack_registry:
          'Tax Table Authoring publish updates TaxTableSet; it does not create pack_registry rows (see docs/payroll/TAX_TABLE_GOVERNANCE_RUNBOOK.md).',
      },
    };
  }
}
