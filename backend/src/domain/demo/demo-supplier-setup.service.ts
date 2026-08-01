import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ContractType, SupplierStatus } from '@prisma/client';
import { PrismaService } from '../../core/database/prisma.service';
import { AuditService } from '../../core/audit/audit.service';
import { AccessContext } from '../../core/auth/interfaces/access-context.interface';
import { SuppliersService } from '../suppliers/suppliers.service';
import {
  DEMO_CLEAN_SUPPLIER_EXTERNAL_ID,
  DEMO_SEED_CONTRACT_NUMBER,
  DEMO_SEED_CONTRACT_TITLE,
  DEMO_SUPPLIER_ADMIN_EMAIL,
} from './demo-supplier.constants';
import { clearSupplierPortalWorkers } from './demo-supplier-portal-reset.util';

export type DemoSupplierSetupResult = {
  supplierId: string;
  supplierStatus: SupplierStatus;
  supplierActivated: boolean;
  portalWorkersRemoved: number;
  portalMembership: {
    userEmail: string;
    role: string;
  };
  contract: {
    id: string;
    contractNumber: string;
    status: string;
    created: boolean;
  };
};

/**
 * DEMO_MODE only — portal membership + ACTIVE supplier contract for the promoted Oracle demo supplier.
 */
@Injectable()
export class DemoSupplierSetupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly suppliersService: SuppliersService,
    private readonly auditService: AuditService,
  ) {}

  assertDemoMode(): void {
    const demoMode = this.config.get<string>('DEMO_MODE') === 'true';
    const nodeEnv = this.config.get<string>('NODE_ENV') ?? 'development';
    if (!demoMode && nodeEnv === 'production') {
      throw new BadRequestException('Demo supplier setup is disabled');
    }
  }

  async completeSupplierSetup(
    accessContext: AccessContext,
  ): Promise<DemoSupplierSetupResult> {
    this.assertDemoMode();

    const organizationId = accessContext.targetOrganizationId;
    if (!organizationId) {
      throw new BadRequestException('Organization context is required');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: {
        organizationId,
        externalSupplierId: DEMO_CLEAN_SUPPLIER_EXTERNAL_ID,
      },
    });

    if (!supplier) {
      throw new BadRequestException(
        `Promoted supplier ${DEMO_CLEAN_SUPPLIER_EXTERNAL_ID} not found — synchronize suppliers and create a governance record first.`,
      );
    }

    let supplierStatus = supplier.status;
    let supplierActivated = false;

    if (supplier.status !== SupplierStatus.ACTIVE) {
      supplierActivated = await this.activateSupplierForDemo(
        accessContext,
        supplier.id,
        supplier.status,
        organizationId,
      );
      supplierStatus = SupplierStatus.ACTIVE;
    }

    const portalWorkersRemoved = await clearSupplierPortalWorkers(
      this.prisma,
      organizationId,
      supplier.id,
    );

    const membership = await this.suppliersService.assignPortalMembership(
      accessContext,
      supplier.id,
      { userEmail: DEMO_SUPPLIER_ADMIN_EMAIL, role: 'ADMIN' },
    );

    const contract = await this.ensureActiveDemoContract(organizationId, supplier.id);

    return {
      supplierId: supplier.id,
      supplierStatus,
      supplierActivated,
      portalWorkersRemoved,
      portalMembership: {
        userEmail: membership.userEmail,
        role: membership.role,
      },
      contract,
    };
  }

  private async activateSupplierForDemo(
    accessContext: AccessContext,
    supplierId: string,
    fromStatus: SupplierStatus,
    organizationId: string,
  ): Promise<boolean> {
    if (fromStatus === SupplierStatus.PENDING_APPROVAL) {
      try {
        await this.suppliersService.transitionStatus(accessContext, supplierId, {
          targetStatus: SupplierStatus.ACTIVE,
          reason: 'Demo supplier setup helper',
        });
        return true;
      } catch {
        // Demo bypass when evidence or authority mode blocks the normal approval path.
      }
    }

    await this.prisma.supplier.update({
      where: { id: supplierId },
      data: { status: SupplierStatus.ACTIVE },
    });

    await this.auditService.logAction(
      accessContext.actorUserId,
      'SUPPLIER_APPROVED',
      'Supplier',
      supplierId,
      { status: fromStatus },
      { status: SupplierStatus.ACTIVE },
      {
        organizationId,
        metadata: {
          reason: 'Demo supplier setup helper',
          fromStatus,
          toStatus: SupplierStatus.ACTIVE,
          demoBypass: true,
        },
      },
    );

    return true;
  }

  private async ensureActiveDemoContract(
    organizationId: string,
    supplierId: string,
  ): Promise<DemoSupplierSetupResult['contract']> {
    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + 12);

    const existing = await this.prisma.supplierContract.findFirst({
      where: {
        organizationId,
        supplierId,
        contractNumber: DEMO_SEED_CONTRACT_NUMBER,
      },
    });

    if (existing) {
      const updated = await this.prisma.supplierContract.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          contractType: ContractType.TIME_AND_MATERIALS,
          title: DEMO_SEED_CONTRACT_TITLE,
          startDate,
          endDate,
        },
      });

      return {
        id: updated.id,
        contractNumber: updated.contractNumber,
        status: updated.status,
        created: false,
      };
    }

    const created = await this.prisma.supplierContract.create({
      data: {
        organizationId,
        supplierId,
        contractNumber: DEMO_SEED_CONTRACT_NUMBER,
        contractType: ContractType.TIME_AND_MATERIALS,
        title: DEMO_SEED_CONTRACT_TITLE,
        startDate,
        endDate,
        status: 'ACTIVE',
      },
    });

    return {
      id: created.id,
      contractNumber: created.contractNumber,
      status: created.status,
      created: true,
    };
  }
}
