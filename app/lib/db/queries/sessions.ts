import { eq, and, gt, sql } from 'drizzle-orm';
import type { Database } from '../index';
import { sessions, type NewSession, type Session, type SessionWithUser } from '../schema';

/**
 * Session query functions
 * All database operations related to sessions are encapsulated here.
 * Routes should never call db methods directly.
 */
export const sessionQueries = {
  /**
   * Create a new session
   * @param db - Database instance
   * @param data - Session data to insert
   * @returns Created session
   */
  create: async (db: Database, data: NewSession): Promise<Session> => {
    const result = await db.insert(sessions).values(data).returning();
    return result[0];
  },

  /**
   * Find a valid (non-expired) session by ID, including user data
   * @param db - Database instance
   * @param sessionId - Session ID to search for
   * @returns Session with user data, or undefined if not found/expired
   */
  findValidWithUser: async (
    db: Database,
    sessionId: string
  ): Promise<SessionWithUser | undefined> => {
    const now = new Date().toISOString();
    const result = await db.query.sessions.findFirst({
      where: and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)),
      with: {
        user: true,
      },
    });
    return result as SessionWithUser | undefined;
  },

  /**
   * Find a session by ID (without expiration check)
   * @param db - Database instance
   * @param sessionId - Session ID to search for
   * @returns Session or undefined if not found
   */
  findById: async (db: Database, sessionId: string): Promise<Session | undefined> => {
    return db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
    });
  },

  /**
   * Delete a session by ID
   * @param db - Database instance
   * @param sessionId - Session ID to delete
   */
  delete: async (db: Database, sessionId: string): Promise<void> => {
    await db.delete(sessions).where(eq(sessions.id, sessionId));
  },

  /**
   * Delete all expired sessions (cleanup)
   * @param db - Database instance
   * @returns Number of deleted sessions
   */
  deleteExpired: async (db: Database): Promise<number> => {
    const now = new Date().toISOString();
    const result = await db
      .delete(sessions)
      .where(gt(sql`${now}`, sessions.expiresAt))
      .returning();
    return result.length;
  },

  /**
   * Delete all sessions for a user (logout from all devices)
   * @param db - Database instance
   * @param userId - User ID whose sessions to delete
   */
  deleteAllForUser: async (db: Database, userId: number): Promise<void> => {
    await db.delete(sessions).where(eq(sessions.userId, userId));
  },
};
