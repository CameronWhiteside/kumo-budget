import { eq, and, inArray, desc } from 'drizzle-orm';
import type { Database } from '../index';
import {
  transactions,
  transactionTags,
  tags,
  type Transaction,
  type NewTransaction,
  type Tag,
  type Project,
  type Account,
} from '../schema';

export type TransactionWithTags = Transaction & {
  tags: Tag[];
};

export const transactionQueries = {
  async findByProject(db: Database, projectId: Project['id']): Promise<TransactionWithTags[]> {
    const txns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.projectId, projectId))
      .orderBy(desc(transactions.date))
      .all();

    if (txns.length === 0) return [];

    const txnIds = txns.map((t) => t.id);
    const tagLinks = await db
      .select()
      .from(transactionTags)
      .where(inArray(transactionTags.transactionId, txnIds))
      .all();

    const tagIds = [...new Set(tagLinks.map((tl) => tl.tagId))];
    const allTags =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : [];

    const tagMap = new Map(allTags.map((t) => [t.id, t]));

    return txns.map((txn) => ({
      ...txn,
      tags: tagLinks
        .filter((tl) => tl.transactionId === txn.id)
        .map((tl) => tagMap.get(tl.tagId))
        .filter((t): t is Tag => t !== undefined),
    }));
  },

  async findByAccount(db: Database, accountId: Account['id']): Promise<TransactionWithTags[]> {
    const txns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
      .orderBy(desc(transactions.date))
      .all();

    if (txns.length === 0) return [];

    const txnIds = txns.map((t) => t.id);
    const tagLinks = await db
      .select()
      .from(transactionTags)
      .where(inArray(transactionTags.transactionId, txnIds))
      .all();

    const tagIds = [...new Set(tagLinks.map((tl) => tl.tagId))];
    const allTags =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : [];

    const tagMap = new Map(allTags.map((t) => [t.id, t]));

    return txns.map((txn) => ({
      ...txn,
      tags: tagLinks
        .filter((tl) => tl.transactionId === txn.id)
        .map((tl) => tagMap.get(tl.tagId))
        .filter((t): t is Tag => t !== undefined),
    }));
  },

  async findById(db: Database, id: Transaction['id']): Promise<TransactionWithTags | undefined> {
    const txn = await db.select().from(transactions).where(eq(transactions.id, id)).get();
    if (!txn) return undefined;

    const tagLinks = await db
      .select()
      .from(transactionTags)
      .where(eq(transactionTags.transactionId, id))
      .all();

    const tagIds = tagLinks.map((tl) => tl.tagId);
    const txnTags =
      tagIds.length > 0 ? await db.select().from(tags).where(inArray(tags.id, tagIds)).all() : [];

    return { ...txn, tags: txnTags };
  },

  async sourceHashExists(
    db: Database,
    projectId: Project['id'],
    sourceHash: string
  ): Promise<boolean> {
    const result = await db
      .select({ id: transactions.id })
      .from(transactions)
      .where(and(eq(transactions.projectId, projectId), eq(transactions.sourceHash, sourceHash)))
      .get();
    return result !== undefined;
  },

  async checkSourceHashes(
    db: Database,
    projectId: Project['id'],
    hashes: string[]
  ): Promise<Set<string>> {
    if (hashes.length === 0) return new Set();
    const results = await db
      .select({ sourceHash: transactions.sourceHash })
      .from(transactions)
      .where(and(eq(transactions.projectId, projectId), inArray(transactions.sourceHash, hashes)))
      .all();
    return new Set(results.map((r) => r.sourceHash).filter((h): h is string => h !== null));
  },

  async create(db: Database, data: NewTransaction, tagIds?: Tag['id'][]): Promise<Transaction> {
    const txn = await db.insert(transactions).values(data).returning().get();

    if (tagIds && tagIds.length > 0) {
      await db
        .insert(transactionTags)
        .values(tagIds.map((tagId) => ({ transactionId: txn.id, tagId })))
        .run();
    }

    return txn;
  },

  async createMany(
    db: Database,
    data: NewTransaction[],
    tagIdsByIndex?: Map<number, Tag['id'][]>
  ): Promise<Transaction[]> {
    if (data.length === 0) return [];

    const txns = await db.insert(transactions).values(data).returning().all();

    if (tagIdsByIndex && tagIdsByIndex.size > 0) {
      const tagInserts: { transactionId: Transaction['id']; tagId: Tag['id'] }[] = [];
      txns.forEach((txn, index) => {
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

  async update(
    db: Database,
    id: Transaction['id'],
    data: Partial<Pick<Transaction, 'amount' | 'date' | 'description' | 'notes'>>,
    tagIds?: Tag['id'][]
  ): Promise<Transaction | undefined> {
    const txn = await db
      .update(transactions)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(transactions.id, id))
      .returning()
      .get();

    if (tagIds !== undefined) {
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

  async delete(db: Database, id: Transaction['id']): Promise<void> {
    await db.delete(transactions).where(eq(transactions.id, id));
  },
};
