/**
 * Prisma 7 scripts — same PostgreSQL adapter pattern as {@link PrismaService}.
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export type ScriptPrisma = {
  prisma: PrismaClient;
  shutdown: () => Promise<void>;
};

export function createScriptPrisma(): ScriptPrisma {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required');
  }
  const pool = new Pool({ connectionString: url });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({
    adapter,
  });

  return {
    prisma,
    shutdown: async () => {
      await prisma.$disconnect();
      await pool.end();
    },
  };
}
