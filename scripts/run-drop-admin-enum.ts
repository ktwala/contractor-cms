/**
 * One-off: remove ADMIN from RoleName enum. PostgreSQL has no DROP VALUE for enums;
 * we recreate the type without ADMIN. Run: DATABASE_URL=... npx tsx scripts/run-drop-admin-enum.ts
 */
import { Client } from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const ROLE_NAME_VALUES = [
  'PAYROLL_MANAGER', 'APPROVER', 'HR_ADMIN', 'TENANT_ADMIN', 'PAYROLL_CLERK',
  'PAYROLL_APPROVER', 'FINANCE_APPROVER', 'SARS_OFFICER', 'SARS_APPROVER',
  'AUDITOR', 'AUDITOR_READONLY', 'EMPLOYEE_SELF_SERVICE', 'INTEGRATION_IGA', 'PLATFORM_SUPERADMIN',
];

async function main() {
  const client = new Client({ connectionString: url });
  await client.connect();

  try {
    const versionResult = await client.query('SHOW server_version');
    console.log('PostgreSQL version:', versionResult.rows[0].server_version);

    console.log('Recreating RoleName enum without ADMIN...');
    const valuesList = ROLE_NAME_VALUES.map((v) => `'${v}'`).join(',');
    await client.query('ALTER TYPE "RoleName" RENAME TO "RoleName_old"');
    await client.query(`CREATE TYPE "RoleName" AS ENUM (${valuesList})`);
    await client.query(
      'ALTER TABLE "roles" ALTER COLUMN "name" TYPE "RoleName" USING "name"::text::"RoleName"',
    );
    await client.query('DROP TYPE "RoleName_old"');
    console.log('Done.');
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
