/**
 * Authentication barrel export
 * Import all auth utilities from this file for convenience
 */
export { hashPassword, verifyPassword } from './password';
export {
  generateSessionId,
  getSessionExpiry,
  createSession,
  createSessionCookie,
  createLogoutCookie,
  getSessionIdFromCookie,
  validateSession,
  destroySession,
} from './session';
export {
  requireAuth,
  getOptionalAuth,
  redirectIfAuthenticated,
  type AuthContext,
} from './middleware';
