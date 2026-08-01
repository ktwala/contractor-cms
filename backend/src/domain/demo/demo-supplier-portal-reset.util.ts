import { PrismaService } from '../../core/database/prisma.service';

/**
 * Remove all external workers linked to a supplier portal demo supplier (Atlas).
 * Keeps supplier, membership, and contracts intact.
 */
export async function clearSupplierPortalWorkers(
  prisma: PrismaService,
  organizationId: string,
  supplierId: string,
): Promise<number> {
  const contractorIds = (
    await prisma.contractor.findMany({
      where: { organizationId, supplierId },
      select: { id: true },
    })
  ).map((c) => c.id);

  if (contractorIds.length === 0) {
    return 0;
  }

  const engagementIds = (
    await prisma.contractorEngagement.findMany({
      where: { contractorId: { in: contractorIds } },
      select: { id: true },
    })
  ).map((e) => e.id);

  if (engagementIds.length > 0) {
    await prisma.responsibleManagerAccountabilityTask.deleteMany({
      where: { engagementId: { in: engagementIds } },
    });
  }

  await prisma.contractorGovernanceRemediation.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.contractorSourceDrift.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.withholdingInstruction.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.contractorTaxClassification.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.timesheet.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.contractorEngagement.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.contractorIdentityMap.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.contractorMigrationAudit.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.contractorWorkforceHistory.deleteMany({
    where: { contractorId: { in: contractorIds } },
  });
  await prisma.user.updateMany({
    where: { contractorId: { in: contractorIds } },
    data: { contractorId: null },
  });
  await prisma.hcmContractorStaging.updateMany({
    where: {
      organizationId,
      proposedContractorId: { in: contractorIds },
    },
    data: { proposedContractorId: null },
  });
  await prisma.contractor.deleteMany({
    where: { id: { in: contractorIds } },
  });

  return contractorIds.length;
}
