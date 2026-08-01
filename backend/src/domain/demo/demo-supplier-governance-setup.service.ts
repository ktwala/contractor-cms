import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SupplierSourceSyncStatus,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { SupplierGovernanceTwinPromotionService } from '../supplier-sources/supplier-governance-twin-promotion.service';
import {
  SUPPLIER_GOV_DEMO_ACTIVE_EXTERNAL_IDS,
  SUPPLIER_GOV_DEMO_PENDING_EXTERNAL_ID,
  SUPPLIER_GOV_DEMO_SUSPENDED_EXTERNAL_ID,
  shouldApplyDemoGovernanceStatus,
} from './demo-supplier-governance.constants';

/**
 * DEMO_MODE — after supplier readiness assessment, materialize governed supplier lifecycle
 * for the five Oracle-synchronized suppliers only.
 */
@Injectable()
export class DemoSupplierGovernanceSetupService {
  private readonly logger = new Logger(DemoSupplierGovernanceSetupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly promotionService: SupplierGovernanceTwinPromotionService,
  ) {}

  isDemoModeEnabled(): boolean {
    const demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    return demoMode || nodeEnv !== 'production';
  }

  async materializeGovernanceDemoIfNeeded(accessContext: AccessContext): Promise<void> {
    if (!this.isDemoModeEnabled()) {
      return;
    }

    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      return;
    }

    this.logger.log(`Ensuring supplier governance demo for org ${organizationId}`);

    for (const externalSupplierId of SUPPLIER_GOV_DEMO_ACTIVE_EXTERNAL_IDS) {
      await this.ensureSupplierRole(
        accessContext,
        organizationId,
        externalSupplierId,
        SupplierStatus.ACTIVE,
      );
    }

    await this.ensureSupplierRole(
      accessContext,
      organizationId,
      SUPPLIER_GOV_DEMO_SUSPENDED_EXTERNAL_ID,
      SupplierStatus.SUSPENDED,
    );

    await this.ensureSupplierRole(
      accessContext,
      organizationId,
      SUPPLIER_GOV_DEMO_PENDING_EXTERNAL_ID,
      SupplierStatus.PENDING_APPROVAL,
    );
  }

  private async ensureSupplierRole(
    accessContext: AccessContext,
    organizationId: string,
    externalSupplierId: string,
    targetStatus: SupplierStatus,
  ): Promise<void> {
    const existing = await this.prisma.supplier.findFirst({
      where: { organizationId, externalSupplierId },
      select: { id: true, status: true },
    });

    if (existing) {
      if (shouldApplyDemoGovernanceStatus(existing.status, targetStatus)) {
        await this.prisma.supplier.update({
          where: { id: existing.id },
          data: {
            status: targetStatus,
            sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
          },
        });
      }
      return;
    }

    const staging = await this.prisma.supplierSourceStaging.findFirst({
      where: { organizationId, externalSupplierId },
    });

    if (!staging) {
      this.logger.warn(
        `Staging row missing for ${externalSupplierId} — skip governance demo promote`,
      );
      return;
    }

    const promotion = await this.promotionService.promoteStagingRow(accessContext, staging.id);

    await this.prisma.supplier.update({
      where: { id: promotion.supplierId },
      data: {
        status: targetStatus,
        sourceSyncStatus: SupplierSourceSyncStatus.SYNCED,
      },
    });
  }
}
