import { redirect } from 'react-router';
import { createDb } from '../db';
import { getSessionIdFromCookie, validateSession } from './session';
import type { User, Session } from '../db/schema';

/**
 * Environment type for Cloudflare Worker
 */
interface CloudflareEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  SESSION_DURATION_DAYS?: string;
}

/**
 * Auth context returned from authentication middleware
 */
export interface AuthContext {
  user: User;
  session: Session;
}

/**
 * Require authentication for a route
 * Redirects to /login if user is not authenticated
 *
 * @param request - Incoming request
 * @param env - Cloudflare environment bindings
 * @returns Auth context with user and session
 * @throws Redirect to /login if not authenticated
 *
 * @example
 * // In a route loader:
 * export async function loader({ request, context }: Route.LoaderArgs) {
 *   const { user } = await requireAuth(request, context.cloudflare.env);
 *   return { user };
 * }
 */
export async function requireAuth(request: Request, env: CloudflareEnv): Promise<AuthContext> {
  const db = createDb(env.DB);
  const sessionId = getSessionIdFromCookie(request.headers.get('Cookie'), env);

  if (!sessionId) {
    throw redirect('/login');
  }

  const result = await validateSession(db, sessionId);

  if (!result) {
    throw redirect('/login');
  }

  return result;
}

/**
 * Get optional authentication context
 * Returns null if user is not authenticated (doesn't redirect)
 *
 * @param request - Incoming request
 * @param env - Cloudflare environment bindings
 * @returns Auth context or null
 *
 * @example
 * // In a route loader where auth is optional:
 * export async function loader({ request, context }: Route.LoaderArgs) {
 *   const auth = await getOptionalAuth(request, context.cloudflare.env);
 *   return { user: auth?.user ?? null };
 * }
 */
export async function getOptionalAuth(
  request: Request,
  env: CloudflareEnv
): Promise<AuthContext | null> {
  const db = createDb(env.DB);
  const sessionId = getSessionIdFromCookie(request.headers.get('Cookie'), env);

  if (!sessionId) {
    return null;
  }

  return validateSession(db, sessionId);
}

/**
 * Redirect authenticated users away from auth pages
 * Use on login/register pages to redirect logged-in users to home
 *
 * @param request - Incoming request
 * @param env - Cloudflare environment bindings
 * @param redirectTo - Where to redirect authenticated users (default: '/')
 * @throws Redirect if user is authenticated
 *
 * @example
 * // In login route loader:
 * export async function loader({ request, context }: Route.LoaderArgs) {
 *   await redirectIfAuthenticated(request, context.cloudflare.env);
 *   return null;
 * }
 */
export async function redirectIfAuthenticated(
  request: Request,
  env: CloudflareEnv,
  redirectTo = '/'
): Promise<void> {
  const auth = await getOptionalAuth(request, env);

  if (auth) {
    throw redirect(redirectTo);
  }
}
