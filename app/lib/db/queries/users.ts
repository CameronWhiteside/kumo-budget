import { eq } from 'drizzle-orm';
import type { Database } from '../index';
import { users, type NewUser, type User } from '../schema';

/**
 * User query functions
 * All database operations related to users are encapsulated here.
 * Routes should never call db methods directly.
 */
export const userQueries = {
  /**
   * Find a user by their username
   */
  findByUsername: async (db: Database, username: string): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.username, username),
    });
  },

  /**
   * Find a user by their ID
   */
  findById: async (db: Database, id: User['id']): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.id, id),
    });
  },

  /**
   * Create a new user
   */
  create: async (db: Database, data: NewUser): Promise<User> => {
    const result = await db.insert(users).values(data).returning();
    return result[0];
  },

  /**
   * Check if a username already exists
   */
  exists: async (db: Database, username: string): Promise<boolean> => {
    const user = await db.query.users.findFirst({
      where: eq(users.username, username),
      columns: { id: true },
    });
    return user !== undefined;
  },
};
