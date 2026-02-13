import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema';

/**
 * Creates a Drizzle ORM instance bound to a D1 database
 * @param d1 - D1Database binding from Cloudflare
 * @returns Drizzle ORM instance with schema
 */
export function createDb(d1: D1Database) {
  return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;

// Re-export schema for convenience
export * from './schema';
