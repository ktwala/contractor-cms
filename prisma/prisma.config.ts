import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://workforce:workforce_secret@localhost:5432/workforce_platform?schema=public',
  },
});
