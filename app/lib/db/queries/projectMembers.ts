import { and, eq, count } from 'drizzle-orm';
import type { Database } from '../index';
import {
  projectMembers,
  users,
  type ProjectRole,
  type ProjectMemberWithUser,
  type User,
  type Project,
} from '../schema';

export const projectMemberQueries = {
  addMember: async (
    db: Database,
    projectId: Project['id'],
    userId: User['id'],
    role: ProjectRole
  ): Promise<void> => {
    await db.insert(projectMembers).values({ projectId, userId, role }).onConflictDoNothing();
  },

  removeMember: async (
    db: Database,
    projectId: Project['id'],
    userId: User['id']
  ): Promise<void> => {
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  },

  updateRole: async (
    db: Database,
    projectId: Project['id'],
    userId: User['id'],
    role: ProjectRole
  ): Promise<void> => {
    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  },

  getMemberRole: async (
    db: Database,
    projectId: Project['id'],
    userId: User['id']
  ): Promise<ProjectRole | null> => {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
      columns: { role: true },
    });
    return member?.role ?? null;
  },

  getProjectMembers: async (
    db: Database,
    projectId: Project['id']
  ): Promise<ProjectMemberWithUser[]> => {
    const members = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, projectId),
      with: {
        user: true,
      },
    });
    return members;
  },

  findUserByUsernameForProject: async (
    db: Database,
    username: string
  ): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.username, username),
    });
  },

  isMember: async (
    db: Database,
    projectId: Project['id'],
    userId: User['id']
  ): Promise<boolean> => {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
      columns: { userId: true },
    });
    return member !== undefined;
  },

  countOwners: async (db: Database, projectId: Project['id']): Promise<number> => {
    const result = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')));
    return result[0]?.count ?? 0;
  },
};
