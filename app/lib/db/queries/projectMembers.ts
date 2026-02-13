import { and, eq, count } from 'drizzle-orm';
import type { Database } from '../index';
import {
  projectMembers,
  users,
  type ProjectRole,
  type ProjectMemberWithUser,
  type User,
} from '../schema';

/**
 * Project member query functions
 * All database operations related to project membership are encapsulated here.
 * Routes should never call db methods directly.
 */
export const projectMemberQueries = {
  /**
   * Add a user to a project with specified role
   * Uses 'insert or ignore' pattern to handle duplicates gracefully
   * @param db - Database instance
   * @param projectId - Project ID
   * @param userId - User ID to add
   * @param role - Role to assign
   */
  addMember: async (
    db: Database,
    projectId: number,
    userId: number,
    role: ProjectRole
  ): Promise<void> => {
    await db.insert(projectMembers).values({ projectId, userId, role }).onConflictDoNothing();
  },

  /**
   * Remove a user from a project
   * @param db - Database instance
   * @param projectId - Project ID
   * @param userId - User ID to remove
   */
  removeMember: async (db: Database, projectId: number, userId: number): Promise<void> => {
    await db
      .delete(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  },

  /**
   * Change a member's role in a project
   * @param db - Database instance
   * @param projectId - Project ID
   * @param userId - User ID
   * @param role - New role to assign
   */
  updateRole: async (
    db: Database,
    projectId: number,
    userId: number,
    role: ProjectRole
  ): Promise<void> => {
    await db
      .update(projectMembers)
      .set({ role })
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  },

  /**
   * Get the role of a user in a project
   * @param db - Database instance
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns Role or null if not a member
   */
  getMemberRole: async (
    db: Database,
    projectId: number,
    userId: number
  ): Promise<ProjectRole | null> => {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
      columns: { role: true },
    });
    return member?.role ?? null;
  },

  /**
   * Get all members of a project with their user data
   * @param db - Database instance
   * @param projectId - Project ID
   * @returns Array of project members with user data
   */
  getProjectMembers: async (db: Database, projectId: number): Promise<ProjectMemberWithUser[]> => {
    const members = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, projectId),
      with: {
        user: true,
      },
    });
    return members;
  },

  /**
   * Find a user by username (for the "add member by username" feature)
   * @param db - Database instance
   * @param username - Username to search for
   * @returns User or undefined if not found
   */
  findUserByUsernameForProject: async (
    db: Database,
    username: string
  ): Promise<User | undefined> => {
    return db.query.users.findFirst({
      where: eq(users.username, username),
    });
  },

  /**
   * Check if user is a member of project
   * @param db - Database instance
   * @param projectId - Project ID
   * @param userId - User ID
   * @returns true if user is a member
   */
  isMember: async (db: Database, projectId: number, userId: number): Promise<boolean> => {
    const member = await db.query.projectMembers.findFirst({
      where: and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)),
      columns: { userId: true },
    });
    return member !== undefined;
  },

  /**
   * Count how many owners a project has (to prevent removing last owner)
   * @param db - Database instance
   * @param projectId - Project ID
   * @returns Number of owners
   */
  countOwners: async (db: Database, projectId: number): Promise<number> => {
    const result = await db
      .select({ count: count() })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')));
    return result[0]?.count ?? 0;
  },
};
