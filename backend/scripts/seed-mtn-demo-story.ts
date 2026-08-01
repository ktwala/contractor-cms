/**
 * Completes MTN demo operational layer after Oracle supplier + HCM sync.
 *
 * Prerequisites:
 *   1. npm run reset:connector-demo  (greenfield)
 *   2. Synchronize suppliers + HCM via UI (mock Oracle REST)
 *
 * Usage:
 *   npm run seed:mtn-demo-story
 */
import { loadBackendEnv } from './load-backend-env';

loadBackendEnv();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { DemoMtnStorySetupService } from '../src/domain/demo/demo-mtn-story-setup.service';
import { PrismaService } from '../src/core/database/prisma.service';

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const setup = app.get(DemoMtnStorySetupService);

    const org = await prisma.organization.findUnique({ where: { code: 'DEMO' } });
    const adminUser = await prisma.user.findUnique({ where: { email: 'ops.admin@ewp.demo' } });
    if (!org || !adminUser) {
      throw new Error('DEMO org or ops.admin@ewp.demo missing — run db:seed first');
    }

    console.log('🏗️  Completing MTN demo story (5 suppliers, contracts, portal admins, engagements)…');
    const result = await setup.completeMtnStory({
      targetOrganizationId: org.id,
      organizationId: org.id,
      actorUserId: adminUser.id,
    } as never);

    console.log('\n✅ MTN demo story setup complete.');
    for (const supplier of result.suppliers) {
      console.log(
        `   ${supplier.tradingName}: ${supplier.portalAdminEmail} · contract ${supplier.contractNumber}`,
      );
    }
    console.log(
      `   Materialized ${result.materialized.created} workers (skipped ${result.materialized.skipped})`,
    );
    console.log(
      `   Engagements: ${result.engagementsCreated} created · ${result.sponsoredWorkers} sponsored · ${result.skippedUnsponsoredWorkers} unsponsored by design`,
    );
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error('❌ seed-mtn-demo-story failed:', err);
  process.exit(1);
});
