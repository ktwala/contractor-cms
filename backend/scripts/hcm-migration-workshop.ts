/**
 * PR-CTR-3 workshop CLI — file ingest → validate → optional promote.
 *
 * Usage:
 *   ORG_CODE=DEMO npx ts-node -r tsconfig-paths/register scripts/hcm-migration-workshop.ts \
 *     --file ../test/fixtures/hcm-extract/workshop-sample.json --dry-run
 *
 *   ORG_CODE=DEMO npx ts-node -r tsconfig-paths/register scripts/hcm-migration-workshop.ts \
 *     --file ./test/fixtures/hcm-extract/workshop-sample.json --promote
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { HcmMigrationWorkshopService } from '../src/domain/contractor-migration/services/hcm-migration-workshop.service';
import { PrismaService } from '../src/core/database/prisma.service';

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx === -1 || idx === process.argv.length - 1) return undefined;
  return process.argv[idx + 1];
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function main() {
  const filePath = argValue('--file');
  if (!filePath) {
    console.error('Usage: --file <path> [--dry-run] [--promote] [--publish-iga]');
    process.exit(1);
  }

  const orgCode = process.env.ORG_CODE || 'DEMO';
  const dryRun = hasFlag('--dry-run');
  const promote = hasFlag('--promote');
  const publishIga = hasFlag('--publish-iga');
  const format = (filePath.endsWith('.csv') ? 'csv' : 'json') as 'csv' | 'json';

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });

  try {
    const prisma = app.get(PrismaService);
    const workshop = app.get(HcmMigrationWorkshopService);

    const org = await prisma.organization.findFirst({
      where: { code: orgCode },
    });
    if (!org) {
      console.error(`Organization not found for ORG_CODE=${orgCode}`);
      process.exit(1);
    }

    const absolutePath = resolve(process.cwd(), filePath);
    const content = readFileSync(absolutePath, 'utf8');

    console.log(`\n=== HCM migration workshop (org=${org.code}, dryRun=${dryRun}) ===\n`);

    const result = await workshop.runFilePipeline(
      {
        organizationId: org.id,
        format,
        content,
        fileName: filePath.split('/').pop(),
        waveLabel: `WORKSHOP_${new Date().toISOString().slice(0, 10)}`,
        dryRun,
      },
      {
        validateAfterIngest: !dryRun,
        promotePassed: promote && !dryRun,
        publishToIga: publishIga || (promote && !dryRun),
      },
    );

    console.log('Ingest:', JSON.stringify(result.ingest, null, 2));
    if (result.validation.length) {
      console.log('\nValidation:');
      for (const v of result.validation) {
        console.log(
          `  ${v.sourcePersonId} → ${v.validationStatus} (${v.errorCount} errors)`,
        );
      }
    }
    if (result.promotion.length) {
      console.log('\nPromotion:');
      for (const p of result.promotion) {
        console.log(
          `  ${p.stagingId} → ${p.success ? p.contractorBusinessId : p.errorCode}`,
        );
      }
    }

    console.log('\nDone.\n');
  } finally {
    await app.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
