/**
 * Verify sars_submission_queue has legal_entity_id populated and matches legal_entities
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const queue = await prisma.sarsSubmissionQueue.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      batchId: true,
      documentType: true,
      documentId: true,
      legalEntityId: true,
      status: true,
      createdAt: true,
    },
  });

  const legalEntities = await prisma.legalEntity.findMany({
    select: { id: true, code: true, name: true },
  });
  const validIds = new Set(legalEntities.map((le) => le.id));

  console.log('\n=== SARS SUBMISSION QUEUE (sample) ===\n');
  queue.forEach((q) => {
    console.log(
      `batch: ${q.batchId.slice(0, 8)}... | type: ${q.documentType} | doc: ${q.documentId.slice(0, 8)}... | legal_entity_id: ${q.legalEntityId ?? 'NULL'} | status: ${q.status}`
    );
  });

  const nullCount = queue.filter((q) => !q.legalEntityId).length;
  const invalidCount = queue.filter(
    (q) => q.legalEntityId && !validIds.has(q.legalEntityId)
  ).length;

  console.log('\n=== VALIDATION ===\n');
  console.log(`Total queue items sampled: ${queue.length}`);
  console.log(`legal_entity_id IS NULL: ${nullCount}`);
  console.log(`legal_entity_id NOT in legal_entities: ${invalidCount}`);

  console.log('\n=== LEGAL ENTITIES (expected) ===\n');
  legalEntities.forEach((le) => console.log(`  ${le.id} | ${le.code} | ${le.name}`));

  const allValid = nullCount === 0 && invalidCount === 0;
  console.log('\n' + (allValid ? '✅ All queue items have valid legal_entity_id' : '❌ Issues found'));
  process.exit(allValid ? 0 : 1);
}

main().catch(console.error).finally(() => prisma.$disconnect());
