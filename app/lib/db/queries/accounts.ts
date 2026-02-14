import { eq, and } from 'drizzle-orm';
import type { Database } from '../index';
import { accounts, type Account, type NewAccount, type Project } from '../schema';

/**
 * Account queries
 */
export const accountQueries = {
  async findByProject(db: Database, projectId: Project['id']): Promise<Account[]> {
    return db.select().from(accounts).where(eq(accounts.projectId, projectId)).all();
  },

  async findById(db: Database, id: Account['id']): Promise<Account | undefined> {
    return db.select().from(accounts).where(eq(accounts.id, id)).get();
  },

  async findByIdAndProject(
    db: Database,
    id: Account['id'],
    projectId: Project['id']
  ): Promise<Account | undefined> {
    return db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.projectId, projectId)))
      .get();
  },

  async create(db: Database, data: NewAccount): Promise<Account> {
    const result = await db.insert(accounts).values(data).returning().get();
    return result;
  },

  async update(
    db: Database,
    id: Account['id'],
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

  async delete(db: Database, id: Account['id']): Promise<void> {
    await db.delete(accounts).where(eq(accounts.id, id));
  },
};
