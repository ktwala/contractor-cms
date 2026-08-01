/**
 * Legacy database connection pool
 * This file exists for backward compatibility with legacy services
 * that haven't been migrated to Prisma yet.
 * 
 * NOTE: These services should be migrated to use PrismaService instead.
 */

interface Pool {
  execute(query: string, params?: any[]): Promise<[any[], any]>;
  getConnection(): Promise<Connection>;
}

interface Connection {
  execute(query: string, params?: any[]): Promise<[any[], any]>;
  beginTransaction(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  release(): Promise<void>;
}

// Export a mock pool that simulates MySQL pool behavior
const pool: Pool = {
  execute: async (query: string, params?: any[]): Promise<[any[], any]> => {
    console.warn(`Legacy MySQL pool.execute called: ${query.substring(0, 50)}...`);
    // Simulate a successful query for now (returns [rows, fields] format)
    return [[], {}];
  },
  getConnection: async (): Promise<Connection> => {
    console.warn('Legacy MySQL pool.getConnection called');
    return {
      execute: async (query: string, params?: any[]): Promise<[any[], any]> => {
        console.warn(`Legacy MySQL connection.execute called: ${query.substring(0, 50)}...`);
        return [[], {}];
      },
      beginTransaction: async () => console.warn('Legacy MySQL beginTransaction called'),
      commit: async () => console.warn('Legacy MySQL commit called'),
      rollback: async () => console.warn('Legacy MySQL rollback called'),
      release: async () => console.warn('Legacy MySQL release called'),
    };
  },
};

export default pool;
