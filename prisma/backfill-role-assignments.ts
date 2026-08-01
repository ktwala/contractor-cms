/**
 * RBAC v1.1 Backfill
 *
 * Backfills role_assignments from legacy:
 *   - user_roles (global roles)
 *   - user_legal_entity_access (scoping)
 *
 * Behavior:
 *   - For each (user, role) × (legal entity) create a LEGAL_ENTITY assignment
 *   - Optionally create GLOBAL assignments for selected roles
 *   - Idempotent via createMany({ skipDuplicates: true })
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Adjust this list if you want certain roles to become GLOBAL by default
const GLOBAL_ROLES = new Set<string>(['TENANT_ADMIN', 'PLATFORM_SUPERADMIN']);

async function main() {
  console.log('🔁 RBAC v1.1 backfill starting...');

  // Load all users with legacy role + legal entity access
  const users = await prisma.user.findMany({
    select: {
      id: true,
      userRoles: {
        select: {
          role: { select: { id: true, name: true } },
        },
      },
      legalEntityAccess: {
        select: { legalEntityId: true },
      },
    },
  });

  let totalCreates = 0;

  for (const u of users) {
    const roleRefs = u.userRoles.map((ur) => ur.role).filter(Boolean);
    const entityIds = u.legalEntityAccess.map((lea) => lea.legalEntityId);

    if (roleRefs.length === 0) continue;

    const rows: Array<{
      userId: string;
      roleId: string;
      scopeType: 'GLOBAL' | 'LEGAL_ENTITY';
      legalEntityId: string | null;
    }> = [];

    for (const r of roleRefs) {
      // If role is configured as GLOBAL: create one GLOBAL row
      if (GLOBAL_ROLES.has(String(r.name))) {
        rows.push({
          userId: u.id,
          roleId: r.id,
          scopeType: 'GLOBAL',
          legalEntityId: null,
        });
        continue;
      }

      // Otherwise: create one LEGAL_ENTITY row per entity
      if (entityIds.length === 0) {
        // User has role but no legal entity access - skip or create with first available entity
        // For safety, skip (they had no scope before)
        continue;
      }
      for (const leId of entityIds) {
        rows.push({
          userId: u.id,
          roleId: r.id,
          scopeType: 'LEGAL_ENTITY',
          legalEntityId: leId,
        });
      }
    }

    if (rows.length === 0) continue;

    const res = await prisma.roleAssignment.createMany({
      data: rows,
      skipDuplicates: true,
    });

    totalCreates += res.count;
  }

  console.log(`✅ RBAC v1.1 backfill complete. Created ${totalCreates} role_assignments.`);
}

main()
  .catch((e) => {
    console.error('❌ Backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
