import { eq, and, inArray, desc } from 'drizzle-orm';
import type { Database } from '../index';
import {
  transactions,
  transactionTags,
  tags,
  type Transaction,
  type NewTransaction,
  type Tag,
  type TransactionTag,
} from '../schema';

/**
 * Transaction with tags type
 */
export type TransactionWithTags = Transaction & {
  tags: Tag[];
};

/**
 * Transaction queries
 */
export const transactionQueries = {
  /**
   * Find all transactions for a project (with tags)
   */
  async findByProject(db: Database, projectId: number): Promise<TransactionWithTags[]> {
    const txns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.projectId, projectId))
      .orderBy(desc(transactions.date))
      .all();

    // Batch fetch tags for all transactions
    if (txns.length === 0) return [];

    const txnIds = txns.map((t: Transaction) => t.id);
    const tagLinks: TransactionTag[] = await db
      .select()
      .from(transactionTags)
      .where(inArray(transactionTags.transactionId, txnIds))
      .all();

    const tagIds = [...new Set(tagLinks.map((tl: TransactionTag) => tl.tagId))];
    const allTags: Tag[] =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : [];

    const tagMap = new Map<number, Tag>(allTags.map((t: Tag) => [t.id, t]));

    return txns.map((txn: Transaction) => ({
      ...txn,
      tags: tagLinks
        .filter((tl: TransactionTag) => tl.transactionId === txn.id)
        .map((tl: TransactionTag) => tagMap.get(tl.tagId))
        .filter((t): t is Tag => t !== undefined),
    }));
  },

  /**
   * Find all transactions for an account (with tags)
   */
  async findByAccount(db: Database, accountId: number): Promise<TransactionWithTags[]> {
    const txns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.date))
      .all();

    if (txns.length === 0) return [];

    const txnIds = txns.map((t: Transaction) => t.id);
    const tagLinks: TransactionTag[] = await db
      .select()
      .from(transactionTags)
      .where(inArray(transactionTags.transactionId, txnIds))
      .all();

    const tagIds = [...new Set(tagLinks.map((tl: TransactionTag) => tl.tagId))];
    const allTags: Tag[] =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : [];

    const tagMap = new Map<number, Tag>(allTags.map((t: Tag) => [t.id, t]));

    return txns.map((txn: Transaction) => ({
      ...txn,
      tags: tagLinks
        .filter((tl: TransactionTag) => tl.transactionId === txn.id)
        .map((tl: TransactionTag) => tagMap.get(tl.tagId))
        .filter((t): t is Tag => t !== undefined),
    }));
  },

  /**
   * Find transaction by ID (with tags)
   */
  async findById(db: Database, id: number): Promise<TransactionWithTags | undefined> {
    const txn = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!txn) return undefined;

    const tagLinks: TransactionTag[] = await db
      .select()
      .from(transactionTags)
      .where(eq(transactionTags.transactionId, id))
      .all();

    const tagIds = tagLinks.map((tl: TransactionTag) => tl.tagId);
    const txnTags: Tag[] =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : [];

    return { ...txn, tags: txnTags };
  },

  /**
   * Check if source hash exists (for duplicate detection)
   */
  async sourceHashExists(db: Database, projectId: number, sourceHash: string): Promise<boolean> {
    const result = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.projectId, projectId), eq(transactions.sourceHash, sourceHash)))
      .get();
    return result !== undefined;
  },

  /**
   * Check multiple source hashes (batch)
   */
  async checkSourceHashes(db: Database, projectId: number, hashes: string[]): Promise<Set<string>> {
    if (hashes.length === 0) return new Set();
    const results = await db
      .select({ sourceHash: transactions.sourceHash })
      .from(transactions)
      .where(and(eq(transactions.projectId, projectId), inArray(transactions.sourceHash, hashes)))
      .all();
    return new Set(
      results
        .map((r: { sourceHash: string | null }) => r.sourceHash)
        .filter((h): h is string => h !== null)
    );
  },

  /**
   * Create a new transaction
   */
  async create(db: Database, data: NewTransaction, tagIds?: number[]): Promise<Transaction> {
    const txn = await db.insert(transactions).values(data).returning().get();

    if (tagIds && tagIds.length > 0) {
      await db
        .insert(transactionTags)
        .values(tagIds.map((tagId) => ({ transactionId: txn.id, tagId })))
        .run();
    }

    return txn;
  },

  /**
   * Create multiple transactions (bulk import)
   */
  async createMany(
    db: Database,
    data: NewTransaction[],
    tagIdsByIndex?: Map<number, number[]>
  ): Promise<Transaction[]> {
    if (data.length === 0) return [];

    const txns = await db.insert(transactions).values(data).returning().all();

    // Add tags if provided
    if (tagIdsByIndex && tagIdsByIndex.size > 0) {
      const tagInserts: { transactionId: number; tagId: number }[] = [];
      txns.forEach((txn: Transaction, index: number) => {
        const tIds = tagIdsByIndex.get(index);
        if (tIds) {
          tIds.forEach((tagId) => {
            tagInserts.push({ transactionId: txn.id, tagId });
          });
        }
      });
      if (tagInserts.length > 0) {
        await db.insert(transactionTags).values(tagInserts).run();
      }
    }

    return txns;
  },

  /**
   * Update transaction
   */
  async update(
    db: Database,
    id: number,
    data: Partial<Pick<Transaction, 'amount' | 'date' | 'description' | 'notes'>>,
    tagIds?: number[]
  ): Promise<Transaction | undefined> {
    const txn = await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(transactions.id, id))
      .returning()
      .get();

    if (tagIds !== undefined) {
      // Replace all tags
      await db.delete(transactionTags).where(eq(transactionTags.transactionId, id));
      if (tagIds.length > 0) {
        await db
          .insert(transactionTags)
          .values(tagIds.map((tagId) => ({ transactionId: id, tagId })))
          .run();
      }
    }

    return txn;
  },

  /**
   * Delete transaction
   */
  async delete(db: Database, id: number): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  },
};
