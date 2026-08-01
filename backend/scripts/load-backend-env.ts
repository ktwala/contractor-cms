import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Load DATABASE_URL for standalone scripts (same order as prisma.config.ts).
 */
export function loadBackendEnv(): void {
  const backendRoot = path.resolve(__dirname, '..');
  const envPath = path.join(backendRoot, '.env');
  const examplePath = path.join(backendRoot, '.env.example');

  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
  } else if (fs.existsSync(examplePath)) {
    dotenv.config({ path: examplePath });
  }

  if (!process.env.DATABASE_URL?.trim()) {
    throw new Error(
      'DATABASE_URL is not set. Copy backend/.env.example to backend/.env and adjust, ' +
        'or export DATABASE_URL (Docker: postgresql://contractor_cms:password@localhost:5433/contractor_cms).',
    );
  }
}
