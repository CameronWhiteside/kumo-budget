import { eq, and } from 'drizzle-orm';
import type { Database } from '../index';
import {
  importBatches,
  importBatchRows,
  type ImportBatch,
  type NewImportBatch,
  type ImportBatchRow,
  type NewImportBatchRow,
  type ImportBatchStatus,
} from '../schema';

/**
 * Column mapping interface for CSV imports
 */
export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
}

/**
 * Import batch queries
 */
export const importBatchQueries = {
  /**
   * Find batch by ID
   */
  async findById(db: Database, id: number): Promise<ImportBatch | undefined> {
    return db.select().from(importBatches).where(eq(importBatches.id, id)).get();
  },

  /**
   * Find batch by ID and verify it belongs to project
   */
  async findByIdAndProject(
    db: Database,
    id: number,
    projectId: number
  ): Promise<ImportBatch | undefined> {
    return db
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, id), eq(importBatches.projectId, projectId)))
      .get();
  },

  /**
   * Find all batches for a project
   */
  async findByProject(db: Database, projectId: number): Promise<ImportBatch[]> {
    return db.select().from(importBatches).where(eq(importBatches.projectId, projectId)).all();
  },

  /**
   * Create a new import batch
   */
  async create(db: Database, data: NewImportBatch): Promise<ImportBatch> {
    return db.insert(importBatches).values(data).returning().get();
  },

  /**
   * Update batch status
   */
  async updateStatus(
    db: Database,
    id: number,
    status: ImportBatchStatus,
    completedAt?: string
  ): Promise<ImportBatch | undefined> {
    const updates: Partial<ImportBatch> = { status };
    if (completedAt) {
      updates.completedAt = completedAt;
    }
    return db.update(importBatches).set(updates).where(eq(importBatches.id, id)).returning().get();
  },

  /**
   * Update column mapping
   */
  async updateColumnMapping(
    db: Database,
    id: number,
    columnMapping: ColumnMapping
  ): Promise<ImportBatch | undefined> {
    return db
      .update(importBatches)
      .set({ columnMapping: JSON.stringify(columnMapping), status: 'mapping' })
      .where(eq(importBatches.id, id))
      .returning()
      .get();
  },

  /**
   * Clear R2 key (after deletion)
   */
  async clearR2Key(db: Database, id: number): Promise<void> {
    await db.update(importBatches).set({ r2Key: null }).where(eq(importBatches.id, id));
  },

  /**
   * Delete batch (and cascade to rows)
   */
  async delete(db: Database, id: number): Promise<void> {
    await db.delete(importBatches).where(eq(importBatches.id, id));
  },
};

/**
 * Import batch row queries
 */
export const importBatchRowQueries = {
  /**
   * Find all rows for a batch
   */
  async findByBatch(db: Database, batchId: number): Promise<ImportBatchRow[]> {
    return db.select().from(importBatchRows).where(eq(importBatchRows.batchId, batchId)).all();
  },

  /**
   * Find row by ID
   */
  async findById(db: Database, id: number): Promise<ImportBatchRow | undefined> {
    return db.select().from(importBatchRows).where(eq(importBatchRows.id, id)).get();
  },

  /**
   * Create a single row
   */
  async create(db: Database, data: NewImportBatchRow): Promise<ImportBatchRow> {
    return db.insert(importBatchRows).values(data).returning().get();
  },

  /**
   * Create multiple rows (bulk)
   */
  async createMany(db: Database, data: NewImportBatchRow[]): Promise<ImportBatchRow[]> {
    if (data.length === 0) return [];
    return db.insert(importBatchRows).values(data).returning().all();
  },

  /**
   * Update row exclusion status
   */
  async updateExcluded(
    db: Database,
    id: number,
    excluded: boolean
  ): Promise<ImportBatchRow | undefined> {
    return db
      .update(importBatchRows)
      .set({ excluded })
      .where(eq(importBatchRows.id, id))
      .returning()
      .get();
  },

  /**
   * Update row tags
   */
  async updateTags(
    db: Database,
    id: number,
    tagIds: number[]
  ): Promise<ImportBatchRow | undefined> {
    return db
      .update(importBatchRows)
      .set({ tagIds: JSON.stringify(tagIds) })
      .where(eq(importBatchRows.id, id))
      .returning()
      .get();
  },

  /**
   * Bulk update tags for multiple rows
   */
  async bulkUpdateTags(db: Database, updates: { id: number; tagIds: number[] }[]): Promise<void> {
    // SQLite doesn't support bulk update with different values easily,
    // so we do individual updates in a transaction
    for (const update of updates) {
      await db
        .update(importBatchRows)
        .set({ tagIds: JSON.stringify(update.tagIds) })
        .where(eq(importBatchRows.id, update.id));
    }
  },

  /**
   * Delete all rows for a batch
   */
  async deleteByBatch(db: Database, batchId: number): Promise<void> {
    await db.delete(importBatchRows).where(eq(importBatchRows.batchId, batchId));
  },

  /**
   * Get non-excluded rows for commit
   */
  async getNonExcluded(db: Database, batchId: number): Promise<ImportBatchRow[]> {
    return db
      .select()
      .from(importBatchRows)
      .where(and(eq(importBatchRows.batchId, batchId), eq(importBatchRows.excluded, false)))
      .all();
  },
};
