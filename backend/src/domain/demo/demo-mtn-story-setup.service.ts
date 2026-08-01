import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ContractType,
  ResponsibleManagerAccountabilityStatus,
  SupplierSourceStagingMatchStatus,
  SupplierStatus,
} from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { SupplierGovernanceTwinPromotionService } from '../supplier-sources/supplier-governance-twin-promotion.service';
import {
  MTN_DEMO_CONTRACT_END,
  MTN_DEMO_CONTRACT_START,
  MTN_DEMO_RESPONSIBLE_MANAGER_EMPLOYEE_ID,
  MTN_DEMO_SUPPLIERS,
  MTN_DEMO_WORKERS,
  mtnSupplierByExternalId,
} from './demo-mtn-story.constants';
import { DemoHcmStagingMaterializationService } from './demo-hcm-staging-materialization.service';

export type MtnStorySupplierSetupResult = {
  externalSupplierId: string;
  tradingName: string;
  supplierId: string;
  status: SupplierStatus;
  contractNumber: string;
  portalAdminEmail: string;
  promoted: boolean;
};

export type MtnStorySetupResult = {
  suppliers: MtnStorySupplierSetupResult[];
  materialized: { created: number; skipped: number };
  engagementsCreated: number;
  sponsoredWorkers: number;
  skippedMissingResponsibleManagerWorkers: number;
};

/**
 * DEMO_MODE — completes the MTN supplier ecosystem after Oracle sync:
 * promote all five suppliers, framework contracts, portal admins, materialize workers,
 * and sponsored engagements for operationally-ready workers.
 */
@Injectable()
export class DemoMtnStorySetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditService: AuditService,
    private readonly promotionService: SupplierGovernanceTwinPromotionService,
    private readonly materializationService: DemoHcmStagingMaterializationService,
  ) {}

  assertDemoMode(): void {
    const demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (!demoMode && nodeEnv === 'production') {
      throw new BadRequestException('MTN demo story setup is disabled');
    }
  }

  async completeMtnStory(accessContext: AccessContext): Promise<MtnStorySetupResult> {
    this.assertDemoMode();

    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    const supplierResults: MtnStorySupplierSetupResult[] = [];

    for (const definition of MTN_DEMO_SUPPLIERS) {
      supplierResults.push(
        await this.setupSupplier(accessContext, organizationId, definition.externalSupplierId),
      );
    }

    const materialized =
      await this.materializationService.materializeVisibleContractors(organizationId);

    const engagementStats = await this.seedSponsoredEngagements(organizationId);

    return {
      suppliers: supplierResults,
      materialized,
      ...engagementStats,
    };
  }

  private async setupSupplier(
    accessContext: AccessContext,
    organizationId: string,
    externalSupplierId: string,
  ): Promise<MtnStorySupplierSetupResult> {
    const definition = mtnSupplierByExternalId(externalSupplierId);
    if (!definition) {
      throw new BadRequestException(`Unknown MTN supplier fixture ${externalSupplierId}`);
    }

    const staging = await this.prisma.supplierSourceStaging.findFirst({
      where: {
        organizationId,
        externalSupplierId,
      },
    });

    if (!staging) {
      throw new BadRequestException(
        `Staging row ${externalSupplierId} not found — synchronize suppliers first.`,
      );
    }

    let supplierId = staging.proposedSupplierId;
    let promoted = false;

    if (!supplierId) {
      const promotion = await this.promotionService.promoteStagingRow(accessContext, staging.id);
      supplierId = promotion.supplierId;
      promoted = true;
    }

    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: {
        companyName: definition.companyName,
        tradingName: definition.tradingName,
        email: definition.contactEmail,
        phone: '+27100000000',
        city: definition.region,
        country: 'ZA',
        countryCode: 'ZA',
        status: SupplierStatus.ACTIVE,
      },
    });

    if (staging.matchStatus !== SupplierSourceStagingMatchStatus.IMPORTED) {
      await this.prisma.supplierSourceStaging.update({
        where: { id: staging.id },
        data: {
          matchStatus: SupplierSourceStagingMatchStatus.IMPORTED,
          proposedSupplierId: supplierId,
        },
      });
    }

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_APPROVED',
      'Supplier',
      supplierId,
      { status: SupplierStatus.PENDING_APPROVAL },
      { status: SupplierStatus.ACTIVE },
      {
        organizationId,
        metadata: {
          reason: 'MTN demo story setup',
          externalSupplierId,
          demoBypass: true,
        },
      },
    );

    await this.assignPortalMembership(
      accessContext,
      supplierId,
      definition.portalAdminEmail,
    );

    await this.ensureFrameworkContract(organizationId, supplierId, definition.contractNumber, definition.contractTitle);

    return {
      externalSupplierId,
      tradingName: definition.tradingName,
      supplierId,
      status: SupplierStatus.ACTIVE,
      contractNumber: definition.contractNumber,
      portalAdminEmail: definition.portalAdminEmail,
      promoted,
    };
  }

  private async ensureFrameworkContract(
    organizationId: string,
    supplierId: string,
    contractNumber: string,
    title: string,
  ) {
    const existing = await this.prisma.supplierContract.findFirst({
      where: { organizationId, supplierId, contractNumber },
    });

    if (existing) {
      await this.prisma.supplierContract.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          contractType: ContractType.TIME_AND_MATERIALS,
          title,
          startDate: MTN_DEMO_CONTRACT_START,
          endDate: MTN_DEMO_CONTRACT_END,
        },
      });
      return existing;
    }

    return this.prisma.supplierContract.create({
      data: {
        organizationId,
        supplierId,
        contractNumber,
        contractType: ContractType.TIME_AND_MATERIALS,
        title,
        startDate: MTN_DEMO_CONTRACT_START,
        endDate: MTN_DEMO_CONTRACT_END,
        status: 'ACTIVE',
      },
    });
  }

  private async seedSponsoredEngagements(organizationId: string) {
    const unsponsoredPersonIds = new Set(
      MTN_DEMO_WORKERS.filter((w) => w.scenario === 'unsponsored_operational_governance').map(
        (w) => w.personId,
      ),
    );

    const cleanPersonIds = new Set(
      MTN_DEMO_WORKERS.filter((w) => w.scenario === 'clean_high_confidence').map(
        (w) => w.personId,
      ),
    );

    const contractors = await this.prisma.contractor.findMany({
      where: {
        organizationId,
        legacySourcePersonId: { in: [...cleanPersonIds] },
      },
      select: {
        id: true,
        legacySourcePersonId: true,
        supplierId: true,
      },
    });

    let engagementsCreated = 0;

    for (const contractor of contractors) {
      if (!contractor.supplierId || !contractor.legacySourcePersonId) {
        continue;
      }

      const worker = MTN_DEMO_WORKERS.find((w) => w.personId === contractor.legacySourcePersonId);
      const supplierDef = MTN_DEMO_SUPPLIERS.find((s) =>
        worker?.supplierTradingName ? s.tradingName === worker.supplierTradingName : false,
      );
      if (!supplierDef) {
        continue;
      }

      const contract = await this.prisma.supplierContract.findFirst({
        where: {
          organizationId,
          supplierId: contractor.supplierId,
          contractNumber: supplierDef.contractNumber,
        },
      });

      if (!contract) {
        continue;
      }

      const existing = await this.prisma.contractorEngagement.findFirst({
        where: { contractorId: contractor.id, contractId: contract.id },
      });

      if (existing) {
        await this.prisma.contractorEngagement.update({
          where: { id: existing.id },
          data: {
            role: supplierDef.engagementTitle,
            responsibleManagerEmployeeId: MTN_DEMO_RESPONSIBLE_MANAGER_EMPLOYEE_ID,
            responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
            isActive: true,
          },
        });
        continue;
      }

      await this.prisma.contractorEngagement.create({
        data: {
          contractorId: contractor.id,
          contractId: contract.id,
          role: supplierDef.engagementTitle,
          startDate: MTN_DEMO_CONTRACT_START,
          endDate: MTN_DEMO_CONTRACT_END,
          rateType: 'HOURLY',
          rateAmount: 850,
          currency: 'ZAR',
          isActive: true,
          responsibleManagerEmployeeId: MTN_DEMO_RESPONSIBLE_MANAGER_EMPLOYEE_ID,
          responsibleManagerStatus: ResponsibleManagerAccountabilityStatus.RESPONSIBLE_MANAGER_ASSIGNED,
        },
      });
      engagementsCreated += 1;
    }

    return {
      engagementsCreated,
      sponsoredWorkers: contractors.length,
      skippedMissingResponsibleManagerWorkers: unsponsoredPersonIds.size,
    };
  }

  private async assignPortalMembership(
    accessContext: AccessContext,
    supplierId: string,
    userEmail: string,
  ): Promise<void> {
    const supplier = await this.prisma.supplier.findUnique({ where: { id: supplierId } });
    if (!supplier) {
      throw new BadRequestException(`Supplier ${supplierId} not found`);
    }

    const user = await this.prisma.user.findFirst({
      where: {
        email: userEmail.trim(),
        organizationId: supplier.organizationId,
        isActive: true,
      },
    });
    if (!user) {
      throw new BadRequestException(
        `Portal admin ${userEmail} not found — run db:seed to create MTN supplier admin users`,
      );
    }

    await this.prisma.supplierMembership.upsert({
      where: {
        userId_supplierId: { userId: user.id, supplierId: supplier.id },
      },
      create: {
        userId: user.id,
        supplierId: supplier.id,
        role: 'ADMIN',
        assignedBy: accessContext.actorUserId,
      },
      update: { isActive: true, role: 'ADMIN' },
    });
  }
}
