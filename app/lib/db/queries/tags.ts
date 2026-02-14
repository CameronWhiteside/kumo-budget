import { eq, and, inArray } from 'drizzle-orm';
import type { Database } from '../index';
import { tags, type Tag, type NewTag, type Project } from '../schema';

/**
 * Tag queries
 */
export const tagQueries = {
  async findByProject(db: Database, projectId: Project['id']): Promise<Tag[]> {
    return db.select().from(tags).where(eq(tags.projectId, projectId)).all();
  },

  async findById(db: Database, id: Tag['id']): Promise<Tag | undefined> {
    return db.select().from(tags).where(eq(tags.id, id)).get();
  },

  async findByIdAndProject(
    db: Database,
    id: Tag['id'],
    projectId: Project['id']
  ): Promise<Tag | undefined> {
    return db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.projectId, projectId)))
      .get();
  },

  async findByIds(db: Database, ids: Tag['id'][]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    return db.select().from(tags).where(inArray(tags.id, ids)).all();
  },

  async findByName(db: Database, projectId: Project['id'], name: string): Promise<Tag | undefined> {
    return db
      .select()
      .from(tags)
      .where(and(eq(tags.projectId, projectId), eq(tags.name, name)))
      .get();
  },

  async create(db: Database, data: NewTag): Promise<Tag> {
    const result = await db.insert(tags).values(data).returning().get();
    return result;
  },

  async createMany(db: Database, projectId: Project['id'], names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    const values = names.map((name) => ({ id: crypto.randomUUID(), projectId, name }));
    return db.insert(tags).values(values).returning().all();
  },

  async update(db: Database, id: Tag['id'], name: string): Promise<Tag | undefined> {
    const result = await db.update(tags).set({ name }).where(eq(tags.id, id)).returning().get();
    return result;
  },

  async delete(db: Database, id: Tag['id']): Promise<void> {
    await db.delete(tags).where(eq(tags.id, id));
  },
};
