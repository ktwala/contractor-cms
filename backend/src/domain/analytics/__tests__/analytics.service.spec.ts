import { AnalyticsService } from '../analytics.service';
import {
  COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX,
  COMPARISON_ANCHOR_SUPPLIER_EMAIL,
} from '../../demo/connector-demo-comparison.constants';

describe('AnalyticsService (visible registry alignment)', () => {
  const organizationId = 'org-demo-1';

  function buildService(contractors: Array<{ id: string; isActive: boolean }>) {
    const prisma = {
      contractor: {
        findMany: jest.fn().mockResolvedValue(contractors),
      },
      contractorEngagement: {
        count: jest.fn().mockResolvedValue(0),
      },
      supplier: {
        count: jest.fn().mockResolvedValue(0),
      },
    };
    return {
      service: new AnalyticsService(prisma as never),
      prisma,
    };
  }

  it('getContractorSummary excludes comparison-anchor contractors from queries', async () => {
    const { service, prisma } = buildService([]);
    await service.getContractorSummary({
      isGlobalAccess: false,
      targetOrganizationId: organizationId,
    } as never);

    expect(prisma.contractor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          NOT: { email: { startsWith: COMPARISON_ANCHOR_CONTRACTOR_EMAIL_PREFIX } },
          supplier: expect.objectContaining({
            organizationId,
            AND: expect.arrayContaining([
              { NOT: { email: COMPARISON_ANCHOR_SUPPLIER_EMAIL } },
            ]),
          }),
        }),
      }),
    );
  });

  it('getContractorSummary returns zero when only hidden anchors exist in DB', async () => {
    const { service } = buildService([]);
    const summary = await service.getContractorSummary({
      isGlobalAccess: false,
      targetOrganizationId: organizationId,
    } as never);

    expect(summary.totalContractors).toBe(0);
    expect(summary.activeContractors).toBe(0);
    expect(summary.supplierCount).toBe(0);
  });
});
