import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations, sql } from 'drizzle-orm';

/**
 * Users table - stores user credentials
 */
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
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
  userId: integer('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expiresAt: text('expires_at').notNull(),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
});

/**
 * Relations - defines relationships between tables for query joins
 */
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

// Type exports for use throughout the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

// Type for session with user data joined
export type SessionWithUser = Session & {
  user: User;
};
