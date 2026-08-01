/**
 * Shared env + DB client config for Prisma seed scripts (ts-node).
 * - Loads repo-root `.env` with override so a broken shell `DATABASE_URL` / `PGHOST` does not win.
 * - Parses `DATABASE_URL` into explicit `pg` options (avoids libpq env merging surprises).
 */

import { resolve } from 'node:path';
import { config } from 'dotenv';
import { parseIntoClientConfig } from 'pg-connection-string';
import type { PoolConfig } from 'pg';

export function loadRepoEnvForPrismaSeeds(): PoolConfig {
  config({ path: resolve(__dirname, '../.env'), override: true });

  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env at the repo root. ' +
        'Local Docker Postgres: postgresql://workforce:workforce_secret@localhost:5432/workforce_platform?schema=public',
    );
  }

  return parseIntoClientConfig(url);
}

export function describeDatabaseTargetFromUrl(url: string): string {
  try {
    const c = parseIntoClientConfig(url.trim());
    const host = c.host ?? '(no host)';
    const port = c.port ?? '5432';
    return `${host}:${port}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}
