/**
 * Legacy DatabaseService
 * This file exists for backward compatibility with legacy services
 * that haven't been migrated to Prisma yet.
 * 
 * NOTE: These services should be migrated to use PrismaService instead.
 */

export class DatabaseService {
  async execute() {
    throw new Error(
      'Legacy DatabaseService is no longer supported. Please migrate this service to use PrismaService instead.'
    );
  }

  async query() {
    throw new Error(
      'Legacy DatabaseService is no longer supported. Please migrate this service to use PrismaService instead.'
    );
  }
}
