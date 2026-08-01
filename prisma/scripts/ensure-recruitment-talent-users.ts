/**
 * Upserts talent.*@demo.payroll users + HR_ADMIN for admin-portal entry + Playwright live authz.
 * Safe to re-run. Requires DEMO-ZA-001 and roles from `npm run db:seed`.
 *
 * Run: `npm run demo:seed:recruitment-users`
 */

import { PrismaClient, RoleScopeType } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DEMO_PASSWORD_HASH = '$2b$10$I8FQ5uXGDSVQ9QnLF1rYkewFIRNYCh0knNblp6i1caqEMg4uaJnWa'; // admin123

export async function ensureRecruitmentTalentDemoUsers(prisma: PrismaClient, legalEntityId: string) {
  const recruiterRole = await prisma.role.findUnique({ where: { name: 'RECRUITER' as any } });
  const hiringManagerRole = await prisma.role.findUnique({ where: { name: 'HIRING_MANAGER' as any } });
  const interviewerRole = await prisma.role.findUnique({ where: { name: 'INTERVIEWER' as any } });
  const hrOpsRole = await prisma.role.findUnique({ where: { name: 'HR_OPERATIONS' as any } });
  const hrAdminRole = await prisma.role.findUnique({ where: { name: 'HR_ADMIN' } });

  if (!recruiterRole || !hiringManagerRole || !interviewerRole || !hrOpsRole || !hrAdminRole) {
    console.log('Skipping — recruitment roles not in DB. Run npm run db:seed first.');
    return;
  }

  const talentUsers: Array<{
    email: string;
    firstName: string;
    lastName: string;
    talentRoleId: string;
  }> = [
    { email: 'talent.recruiter@demo.payroll', firstName: 'Talent', lastName: 'Recruiter', talentRoleId: recruiterRole.id },
    {
      email: 'talent.hiring.manager@demo.payroll',
      firstName: 'Talent',
      lastName: 'HiringManager',
      talentRoleId: hiringManagerRole.id,
    },
    { email: 'talent.interviewer@demo.payroll', firstName: 'Talent', lastName: 'Interviewer', talentRoleId: interviewerRole.id },
    { email: 'talent.hrops@demo.payroll', firstName: 'Talent', lastName: 'HROps', talentRoleId: hrOpsRole.id },
  ];

  for (const u of talentUsers) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      create: {
        email: u.email,
        passwordHash: DEMO_PASSWORD_HASH,
        firstName: u.firstName,
        lastName: u.lastName,
        isActive: true,
      },
      update: {},
    });

    for (const roleId of [hrAdminRole.id, u.talentRoleId]) {
      await prisma.roleAssignment.upsert({
        where: {
          userId_roleId_scopeType_legalEntityId: {
            userId: user.id,
            roleId,
            scopeType: RoleScopeType.LEGAL_ENTITY,
            legalEntityId,
          },
        },
        create: {
          userId: user.id,
          roleId,
          scopeType: RoleScopeType.LEGAL_ENTITY,
          legalEntityId,
        },
        update: {},
      });
    }
  }

  console.log(
    '✅ Talent E2E users (password admin123): talent.recruiter@demo.payroll, talent.hiring.manager@demo.payroll, talent.interviewer@demo.payroll, talent.hrops@demo.payroll',
  );
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  try {
    const le = await prisma.legalEntity.findUnique({ where: { code: 'DEMO-ZA-001' } });
    if (!le) {
      console.error('Legal entity DEMO-ZA-001 not found. Run full demo:seed in a dev database first.');
      process.exit(1);
    }
    await ensureRecruitmentTalentDemoUsers(prisma, le.id);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

// Only run when this file is the entrypoint (not when imported from demo-seed.ts).
const entry = process.argv[1] ?? '';
if (entry.includes('ensure-recruitment-talent-users')) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
