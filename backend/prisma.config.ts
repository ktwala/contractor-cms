import { defineConfig } from '@prisma/config';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.example or .env
const envPath = path.resolve(__dirname, '.env');
const fallbackPath = path.resolve(__dirname, '.env.example');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: fallbackPath });
}

export default defineConfig({
  earlyAccess: true,
  datasource: {
    url: process.env.DATABASE_URL,
  }
})
