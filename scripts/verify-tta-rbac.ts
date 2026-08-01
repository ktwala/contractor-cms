#!/usr/bin/env tsx
/**
 * PR-TAX-GOV-2A — Verify TTA permissions + role mappings in the connected database.
 *
 * Run: npm run verify:tta-rbac
 * Requires: DATABASE_URL
 *
 * Confirms:
 * - All canonical tax_table_authoring_* permission rows exist
 * - TENANT_ADMIN, TAX_TABLE_ADMINISTRATOR, GLOBAL_COMPLIANCE_ADMIN each have the full TTA set
 */
import * as dotenv from 'dotenv';
import { PrismaClient, RoleName } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

dotenv.config();

const TTA_CODES = [
  'tax_table_authoring_view',
  'tax_table_authoring_create',
  'tax_table_authoring_import',
  'tax_table_authoring_edit',
  'tax_table_authoring_submit_approval',
  'tax_table_authoring_approve',
  'tax_table_authoring_publish',
  'tax_table_authoring_archive',
  'tax_table_authoring_audit_view',
] as const;

const ROLES_TO_CHECK: RoleName[] = [
  RoleName.TENANT_ADMIN,
  RoleName.TAX_TABLE_ADMINISTRATOR,
  RoleName.GLOBAL_COMPLIANCE_ADMIN,
];

function fail(msg: string): never {
  console.error(`[verify:tta-rbac] FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  try {
    for (const code of TTA_CODES) {
      const row = await prisma.permission.findUnique({ where: { code } });
      if (!row) fail(`Missing permission row: ${code}`);
    }

    for (const roleName of ROLES_TO_CHECK) {
      const role = await prisma.role.findUnique({
        where: { name: roleName },
        include: {
          permissions: { include: { permission: true } },
        },
      });
      if (!role) fail(`Missing role: ${roleName}`);
      const codes = new Set(role.permissions.map((rp) => rp.permission.code));
      for (const code of TTA_CODES) {
        if (!codes.has(code)) {
          fail(`Role ${roleName} missing permission: ${code}`);
        }
      }
    }

    console.log('[verify:tta-rbac] OK — TTA permission rows and role mappings verified.');
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
