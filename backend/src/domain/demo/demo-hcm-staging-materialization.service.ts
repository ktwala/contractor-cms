import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EngagementModel,
  MigrationSourceSystem,
  Prisma,
  SupplierStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../core/database/prisma.service';
import { HcmContractorNormalizationService } from '../contractor-migration/services/hcm-contractor-normalization.service';
import {
  COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX,
  isComparisonAnchorContractor,
  isComparisonAnchorSupplier,
} from './connector-demo-comparison.constants';
import {
  extractDemoWorkerScenarioFromPayload,
  MTN_DEMO_SKIP_MATERIALIZE_SCENARIOS,
} from './demo-mtn-story.constants';

export type DemoMaterializeResult = {
  created: number;
  skipped: number;
};

/**
 * DEMO_MODE only — creates visible CMS contractors from HCM staging after connector sync.
 */
@Injectable()
export class DemoHcmStagingMaterializationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly normalization: HcmContractorNormalizationService,
  ) {}

  assertDemoMode(): void {
    const demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (!demoMode && nodeEnv === 'production') {
      throw new BadRequestException('Demo materialization is disabled');
    }
  }

  async materializeVisibleContractors(organizationId: string): Promise<DemoMaterializeResult> {
    this.assertDemoMode();

    const rows = await this.prisma.hcmContractorStaging.findMany({
      where: { organizationId },
      orderBy: { extractTimestamp: 'asc' },
    });

    let created = 0;
    let skipped = 0;

    for (const row of rows) {
      const scenario = extractDemoWorkerScenarioFromPayload(row.sourcePayloadJson);
      if (scenario && MTN_DEMO_SKIP_MATERIALIZE_SCENARIOS.has(scenario)) {
        skipped += 1;
        continue;
      }

      const normalized = this.normalization.normalize(row.sourcePayloadJson, {
        sourcePersonId: row.sourcePersonId,
        sourcePersonNumber: row.sourcePersonNumber,
      });

      const email =
        normalized.email?.trim().toLowerCase() ??
        `${row.sourcePersonId.toLowerCase()}@demo.materialized.local`;

      if (email.startsWith(COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX)) {
        skipped += 1;
        continue;
      }

      const existing = await this.prisma.contractor.findFirst({
        where: {
          email,
          supplier: { organizationId },
        },
      });
      if (existing && isComparisonAnchorContractor(existing)) {
        skipped += 1;
        continue;
      }

      if (existing) {
        await this.prisma.hcmContractorStaging.update({
          where: { id: row.id },
          data: { proposedContractorId: existing.id },
        });
        skipped += 1;
        continue;
      }

      const supplierId = await this.resolveSupplierId(organizationId, normalized.supplier);
      if (!supplierId) {
        skipped += 1;
        continue;
      }

      const supplier = await this.prisma.supplier.findUnique({
        where: { id: supplierId },
        select: { status: true },
      });
      if (supplier?.status !== SupplierStatus.ACTIVE) {
        skipped += 1;
        continue;
      }

      const display = normalized.displayName?.trim() ?? row.sourcePersonId;
      const nameParts = display.split(/\s+/).filter(Boolean);
      const firstName = nameParts[0] ?? 'Worker';
      const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : row.sourcePersonId;

      const contractor = await this.prisma.contractor.create({
        data: {
          organizationId,
          supplierId,
          firstName,
          lastName,
          email,
          workerClassification: 'SUPPLIER_CONTRACTOR',
          engagementModel: EngagementModel.DIRECT,
          taxResidency: 'ZA',
          skills: [],
          isActive: true,
          legacySourceSystem: MigrationSourceSystem.ORACLE_HCM,
          legacySourcePersonId: row.sourcePersonId,
        },
      });

      await this.prisma.hcmContractorStaging.update({
        where: { id: row.id },
        data: { proposedContractorId: contractor.id },
      });

      created += 1;
    }

    return { created, skipped };
  }

  private async resolveSupplierId(
    organizationId: string,
    vendorName: string | null,
  ): Promise<string | null> {
    const suppliers = (
      await this.prisma.supplier.findMany({
        where: { organizationId },
        select: { id: true, companyName: true, tradingName: true, email: true },
      })
    ).filter((s) => !isComparisonAnchorSupplier(s));

    if (suppliers.length === 0) {
      return null;
    }

    // Workers without a vendor link stay in staging only — do not attach to the first supplier.
    if (!vendorName?.trim()) {
      return null;
    }

    const needle = vendorName.trim().toLowerCase();
    const match = suppliers.find(
      (s) =>
        s.tradingName?.toLowerCase().includes(needle) ||
        s.companyName?.toLowerCase().includes(needle),
    );
    return match?.id ?? null;
  }
}
