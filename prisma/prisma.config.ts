import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'postgresql://payroll:payroll_secret@localhost:5432/payroll_platform?schema=public',
  },
});
