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
  type Project,
  type Tag,
} from '../schema';

export interface ColumnMapping {
  date: string;
  amount: string;
  description: string;
}

export const importBatchQueries = {
  async findById(db: Database, id: ImportBatch['id']): Promise<ImportBatch | undefined> {
    return db.select().from(importBatches).where(eq(importBatches.id, id)).get();
  },

  async findByIdAndProject(
    db: Database,
    id: ImportBatch['id'],
    projectId: Project['id']
  ): Promise<ImportBatch | undefined> {
    return db
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, id), eq(importBatches.projectId, projectId)))
      .get();
  },

  async findByProject(db: Database, projectId: Project['id']): Promise<ImportBatch[]> {
    return db.select().from(importBatches).where(eq(importBatches.projectId, projectId)).all();
  },

  async create(db: Database, data: NewImportBatch): Promise<ImportBatch> {
    return db.insert(importBatches).values(data).returning().get();
  },

  async updateStatus(
    db: Database,
    id: ImportBatch['id'],
    status: ImportBatchStatus,
    completedAt?: string
  ): Promise<ImportBatch | undefined> {
    const updates: Partial<ImportBatch> = { status };
    if (completedAt) {
      updates.completedAt = completedAt;
    }
    return db.update(importBatches).set(updates).where(eq(importBatches.id, id)).returning().get();
  },

  async updateColumnMapping(
    db: Database,
    id: ImportBatch['id'],
    columnMapping: ColumnMapping
  ): Promise<ImportBatch | undefined> {
    return db
      .update(importBatches)
      .set({ columnMapping: JSON.stringify(columnMapping), status: 'mapping' })
      .where(eq(importBatches.id, id))
      .returning()
      .get();
  },

  async clearR2Key(db: Database, id: ImportBatch['id']): Promise<void> {
    await db.update(importBatches).set({ r2Key: null }).where(eq(importBatches.id, id));
  },

  async delete(db: Database, id: ImportBatch['id']): Promise<void> {
    await db.delete(importBatches).where(eq(importBatches.id, id));
  },
};

export const importBatchRowQueries = {
  async findByBatch(db: Database, batchId: ImportBatch['id']): Promise<ImportBatchRow[]> {
    return db.select().from(importBatchRows).where(eq(importBatchRows.batchId, batchId)).all();
  },

  async findById(db: Database, id: ImportBatchRow['id']): Promise<ImportBatchRow | undefined> {
    return db.select().from(importBatchRows).where(eq(importBatchRows.id, id)).get();
  },

  async create(db: Database, data: NewImportBatchRow): Promise<ImportBatchRow> {
    return db.insert(importBatchRows).values(data).returning().get();
  },

  async createMany(db: Database, data: NewImportBatchRow[]): Promise<ImportBatchRow[]> {
    if (data.length === 0) return [];
    return db.insert(importBatchRows).values(data).returning().all();
  },

  async updateExcluded(
    db: Database,
    id: ImportBatchRow['id'],
    excluded: boolean
  ): Promise<ImportBatchRow | undefined> {
    return db
      .update(importBatchRows)
      .set({ excluded })
      .where(eq(importBatchRows.id, id))
      .returning()
      .get();
  },

  async updateTags(
    db: Database,
    id: ImportBatchRow['id'],
    tagIds: Tag['id'][]
  ): Promise<ImportBatchRow | undefined> {
    return db
      .update(importBatchRows)
      .set({ tagIds: JSON.stringify(tagIds) })
      .where(eq(importBatchRows.id, id))
      .returning()
      .get();
  },

  async bulkUpdateTags(
    db: Database,
    updates: { id: ImportBatchRow['id']; tagIds: Tag['id'][] }[]
  ): Promise<void> {
    for (const update of updates) {
      await db
        .update(importBatchRows)
        .set({ tagIds: JSON.stringify(update.tagIds) })
        .where(eq(importBatchRows.id, update.id));
    }
  },

  async deleteByBatch(db: Database, batchId: ImportBatch['id']): Promise<void> {
    await db.delete(importBatchRows).where(eq(importBatchRows.batchId, batchId));
  },

  async getNonExcluded(db: Database, batchId: ImportBatch['id']): Promise<ImportBatchRow[]> {
    return db
      .select()
      .from(importBatchRows)
      .where(and(eq(importBatchRows.batchId, batchId), eq(importBatchRows.excluded, false)))
      .all();
  },
};
