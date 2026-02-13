import { getConfig, type AppConfig } from '../config';
import { sessionQueries } from '../db/queries/sessions';
import type { Database } from '../db';
import type { Session, User } from '../db/schema';

/**
 * Session management utilities
 * Handles session creation, validation, and cookie management
 */

/**
 * Generate a cryptographically secure session ID
 * @returns UUID session ID
 */
export function generateSessionId(): string {
  return crypto.randomUUID();
}

/**
 * Calculate session expiry date based on config
 * @param config - App configuration
 * @returns ISO date string of expiry time
 */
export function getSessionExpiry(config: AppConfig): string {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + config.auth.sessionDurationDays);
  return expiry.toISOString();
}

/**
 * Create a new session in the database
 * @param db - Database instance
 * @param userId - User ID to create session for
 * @param env - Environment object for config
 * @returns Created session
 */
export async function createSession(db: Database, userId: number, env?: object): Promise<Session> {
  const config = getConfig(env);
  const session = await sessionQueries.create(db, {
    id: generateSessionId(),
    userId,
    expiresAt: getSessionExpiry(config),
  });
  return session;
}

/**
 * Create a Set-Cookie header value for a session
 * @param sessionId - Session ID to set in cookie
 * @param env - Environment object for config
 * @returns Cookie header value
 */
export function createSessionCookie(sessionId: string, env?: object): string {
  const config = getConfig(env);
  const maxAge = config.auth.sessionDurationDays * 24 * 60 * 60; // Convert days to seconds

  return [
    `${config.auth.sessionCookieName}=${sessionId}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ].join('; ');
}

/**
 * Create a Set-Cookie header to clear the session cookie
 * @param env - Environment object for config
 * @returns Cookie header value that clears the cookie
 */
export function createLogoutCookie(env?: object): string {
  const config = getConfig(env);

  return [
    `${config.auth.sessionCookieName}=`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    'Max-Age=0',
  ].join('; ');
}

/**
 * Extract session ID from cookie header
 * @param cookieHeader - Cookie header string from request
 * @param env - Environment object for config
 * @returns Session ID or null if not found
 */
export function getSessionIdFromCookie(cookieHeader: string | null, env?: object): string | null {
  if (!cookieHeader) return null;

  const config = getConfig(env);
  const cookieName = config.auth.sessionCookieName;
  const match = new RegExp(`${cookieName}=([^;]+)`).exec(cookieHeader);

  return match ? match[1] : null;
}

/**
 * Validate a session and get associated user
 * @param db - Database instance
 * @param sessionId - Session ID to validate
 * @returns User and session if valid, null otherwise
 */
export async function validateSession(
  db: Database,
  sessionId: string
): Promise<{ user: User; session: Session } | null> {
  const sessionWithUser = await sessionQueries.findValidWithUser(db, sessionId);

  if (!sessionWithUser) {
    return null;
  }

  return {
    user: sessionWithUser.user,
    session: sessionWithUser,
  };
}

/**
 * Destroy a session (logout)
 * @param db - Database instance
 * @param sessionId - Session ID to destroy
 */
export async function destroySession(db: Database, sessionId: string): Promise<void> {
  await sessionQueries.delete(db, sessionId);
}
