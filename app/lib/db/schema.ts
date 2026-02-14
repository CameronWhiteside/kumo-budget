import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Users table - stores user credentials
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // UUID
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Sessions table - stores active user sessions
 */
export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(), // UUID
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Projects table - stores projects with optional hierarchy (sub-projects)
 * Note: parentId uses self-referential FK - cascade delete handled by SQLite
 */
export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(), // UUID
  name: text('name').notNull(),
  // Self-referential FK - SQLite handles this with deferred constraint checking
  parentId: text('parent_id'),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Project member roles
 */
export const PROJECT_ROLES = ['owner', 'editor', 'viewer'] as const;
export type ProjectRole = (typeof PROJECT_ROLES)[number];

/**
 * Project members table - many-to-many relationship between users and projects
 */
export const projectMembers = sqliteTable(
  'project_members',
  {
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    role: text('role', { enum: PROJECT_ROLES }).notNull().default('viewer'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [primaryKey({ columns: [table.userId, table.projectId] })]
);

/**
 * Relations - defines relationships between tables for query joins
 */
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projectMemberships: many(projectMembers),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  parent: one(projects, {
    fields: [projects.parentId],
    references: [projects.id],
    relationName: 'parentChild',
  }),
  children: many(projects, { relationName: 'parentChild' }),
  members: many(projectMembers),
}));

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
}));

/**
 * Account types
 */
export const ACCOUNT_TYPES = ['checking', 'savings', 'credit_card', 'cash', 'other'] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

/**
 * Accounts table - bank accounts, credit cards, etc.
 */
export const accounts = sqliteTable('accounts', {
  id: text('id').primaryKey(), // UUID
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type', { enum: ACCOUNT_TYPES }).notNull().default('checking'),
  balance: integer('balance').notNull().default(0), // in cents, user-entered
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Import batch statuses
 */
export const IMPORT_BATCH_STATUSES = [
  'uploading',
  'mapping',
  'reviewing',
  'completed',
  'abandoned',
] as const;
export type ImportBatchStatus = (typeof IMPORT_BATCH_STATUSES)[number];

/**
 * Import batches table - tracks CSV import state
 */
export const importBatches = sqliteTable('import_batches', {
  id: text('id').primaryKey(), // UUID
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  rowCount: integer('row_count'),
  status: text('status', { enum: IMPORT_BATCH_STATUSES }).notNull().default('uploading'),
  r2Key: text('r2_key'), // null after completion
  columnMapping: text('column_mapping'), // JSON: { date: 'Date', amount: 'Amount', description: 'Description' }
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  completedAt: text('completed_at'),
});

/**
 * Import batch rows table - temp storage during review
 */
export const importBatchRows = sqliteTable('import_batch_rows', {
  id: text('id').primaryKey(), // UUID
  batchId: text('batch_id')
    .notNull()
    .references(() => importBatches.id, { onDelete: 'cascade' }),
  rowIndex: integer('row_index').notNull(),
  rawData: text('raw_data').notNull(), // original CSV row as JSON
  sourceHash: text('source_hash').notNull(), // SHA256 for duplicate check
  parsedAmount: integer('parsed_amount'), // in cents
  parsedDate: text('parsed_date'),
  parsedDescription: text('parsed_description'),
  isDuplicate: integer('is_duplicate', { mode: 'boolean' }).notNull().default(false),
  excluded: integer('excluded', { mode: 'boolean' }).notNull().default(false),
  tagIds: text('tag_ids'), // JSON array of tag IDs (before commit)
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Transactions table - income/expense entries
 */
export const transactions = sqliteTable('transactions', {
  id: text('id').primaryKey(), // UUID
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  accountId: text('account_id')
    .notNull()
    .references(() => accounts.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // positive or negative, in cents
  date: text('date').notNull(), // ISO date
  description: text('description').notNull(),
  notes: text('notes'),
  sourceHash: text('source_hash'), // SHA256 of original CSV row for duplicate detection
  importBatchId: text('import_batch_id').references(() => importBatches.id, {
    onDelete: 'set null',
  }),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Tags table - project-scoped labels
 */
export const tags = sqliteTable('tags', {
  id: text('id').primaryKey(), // UUID
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Transaction tags table - many-to-many join
 */
export const transactionTags = sqliteTable(
  'transaction_tags',
  {
    transactionId: text('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.transactionId, table.tagId] })]
);

/**
 * Relations for new tables
 */
export const accountsRelations = relations(accounts, ({ one, many }) => ({
  project: one(projects, {
    fields: [accounts.projectId],
    references: [projects.id],
  }),
  transactions: many(transactions),
  importBatches: many(importBatches),
}));

export const importBatchesRelations = relations(importBatches, ({ one, many }) => ({
  project: one(projects, {
    fields: [importBatches.projectId],
    references: [projects.id],
  }),
  account: one(accounts, {
    fields: [importBatches.accountId],
    references: [accounts.id],
  }),
  rows: many(importBatchRows),
  transactions: many(transactions),
}));

export const importBatchRowsRelations = relations(importBatchRows, ({ one }) => ({
  batch: one(importBatches, {
    fields: [importBatchRows.batchId],
    references: [importBatches.id],
  }),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  project: one(projects, {
    fields: [transactions.projectId],
    references: [projects.id],
  }),
  account: one(accounts, {
    fields: [transactions.accountId],
    references: [accounts.id],
  }),
  importBatch: one(importBatches, {
    fields: [transactions.importBatchId],
    references: [importBatches.id],
  }),
  transactionTags: many(transactionTags),
}));

export const tagsRelations = relations(tags, ({ one, many }) => ({
  project: one(projects, {
    fields: [tags.projectId],
    references: [projects.id],
  }),
  transactionTags: many(transactionTags),
}));

export const transactionTagsRelations = relations(transactionTags, ({ one }) => ({
  transaction: one(transactions, {
    fields: [transactionTags.transactionId],
    references: [transactions.id],
  }),
  tag: one(tags, {
    fields: [transactionTags.tagId],
    references: [tags.id],
  }),
}));

// Type exports for use throughout the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
export type TransactionTag = typeof transactionTags.$inferSelect;
export type NewTransactionTag = typeof transactionTags.$inferInsert;
export type ImportBatch = typeof importBatches.$inferSelect;
export type NewImportBatch = typeof importBatches.$inferInsert;
export type ImportBatchRow = typeof importBatchRows.$inferSelect;
export type NewImportBatchRow = typeof importBatchRows.$inferInsert;

// Type for session with user data joined
export type SessionWithUser = Session & {
  user: User;
};

// Type for project with members joined
export type ProjectWithMembers = Project & {
  members: (ProjectMember & { user: User })[];
};

// Type for project member with user data
export type ProjectMemberWithUser = ProjectMember & {
  user: User;
};

// Type for transaction with tags
export type TransactionWithTags = Transaction & {
  tags: Tag[];
};

// Type for import batch row with duplicate info
export type ImportBatchRowWithStatus = ImportBatchRow & {
  isDuplicate: boolean;
  excluded: boolean;
};
