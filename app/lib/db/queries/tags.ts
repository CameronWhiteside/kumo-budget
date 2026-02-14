import { eq, and, inArray } from 'drizzle-orm';
import type { Database } from '../index';
import { tags, type Tag, type NewTag } from '../schema';

/**
 * Tag queries
 */
export const tagQueries = {
  /**
   * Find all tags for a project
   */
  async findByProject(db: Database, projectId: number): Promise<Tag[]> {
    return db.select().from(tags).where(eq(tags.projectId, projectId)).all();
  },

  /**
   * Find tag by ID
   */
  async findById(db: Database, id: number): Promise<Tag | undefined> {
    return db.select().from(tags).where(eq(tags.id, id)).get();
  },

  /**
   * Find tag by ID and verify it belongs to project
   */
  async findByIdAndProject(db: Database, id: number, projectId: number): Promise<Tag | undefined> {
    return db
      .select()
      .from(tags)
      .where(and(eq(tags.id, id), eq(tags.projectId, projectId)))
      .get();
  },

  /**
   * Find tags by IDs (for bulk lookup)
   */
  async findByIds(db: Database, ids: number[]): Promise<Tag[]> {
    if (ids.length === 0) return [];
    return db.select().from(tags).where(inArray(tags.id, ids)).all();
  },

  /**
   * Find tag by name in project
   */
  async findByName(db: Database, projectId: number, name: string): Promise<Tag | undefined> {
    return db
      .select()
      .from(tags)
      .where(and(eq(tags.projectId, projectId), eq(tags.name, name)))
      .get();
  },

  /**
   * Create a new tag
   */
  async create(db: Database, data: NewTag): Promise<Tag> {
    const result = await db.insert(tags).values(data).returning().get();
    return result;
  },

  /**
   * Create multiple tags
   */
  async createMany(db: Database, projectId: number, names: string[]): Promise<Tag[]> {
    if (names.length === 0) return [];
    const values = names.map((name) => ({ projectId, name }));
    return db.insert(tags).values(values).returning().all();
  },

  /**
   * Update tag
   */
  async update(db: Database, id: number, name: string): Promise<Tag | undefined> {
    const result = await db.update(tags).set({ name }).where(eq(tags.id, id)).returning().get();
    return result;
  },

  /**
   * Delete tag
   */
  async delete(db: Database, id: number): Promise<void> {
    await db.delete(tags).where(eq(tags.id, id));
  },
};
