import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
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
 * Projects table - stores projects with optional hierarchy (sub-projects)
 * Note: parentId uses self-referential FK - cascade delete handled by SQLite
 */
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  // Self-referential FK - SQLite handles this with deferred constraint checking
  parentId: integer('parent_id'),
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
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    projectId: integer('project_id')
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

// Type exports for use throughout the app
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;

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
