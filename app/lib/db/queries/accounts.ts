import { eq, and } from 'drizzle-orm';
import type { Database } from '../index';
import { accounts, type Account, type NewAccount } from '../schema';

/**
 * Account queries
 */
export const accountQueries = {
  /**
   * Find all accounts for a project
   */
  async findByProject(db: Database, projectId: number): Promise<Account[]> {
    return db.select().from(accounts).where(eq(accounts.projectId, projectId)).all();
  },

  /**
   * Find account by ID
   */
  async findById(db: Database, id: number): Promise<Account | undefined> {
    return db.select().from(accounts).where(eq(accounts.id, id)).get();
  },

  /**
   * Find account by ID and verify it belongs to project
   */
  async findByIdAndProject(
    db: Database,
    id: number,
    projectId: number
  ): Promise<Account | undefined> {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.projectId, projectId)))
      .get();
  },

  /**
   * Create a new account
   */
  async create(db: Database, data: NewAccount): Promise<Account> {
    const result = await db.insert(accounts).values(data).returning().get();
    return result;
  },

  /**
   * Update account
   */
  async update(
    db: Database,
    id: number,
    data: Partial<Pick<Account, 'name' | 'type' | 'balance'>>
  ): Promise<Account | undefined> {
    const result = await db
      .update(accounts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, id))
      .returning()
      .get();
    return result;
  },

  /**
   * Delete account
   */
  async delete(db: Database, id: number): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  },
};
