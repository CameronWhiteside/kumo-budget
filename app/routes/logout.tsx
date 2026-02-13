import { redirect } from 'react-router';

import type { Route } from './+types/logout';
import { createDb } from '~/lib/db';
import { getSessionIdFromCookie, destroySession, createLogoutCookie } from '~/lib/auth';

/**
 * Action - handles logout
 * Destroys the session and clears the cookie
 */
export async function action({ request, context }: Route.ActionArgs) {
  const db = createDb(context.cloudflare.env.DB);
  const sessionId = getSessionIdFromCookie(request.headers.get('Cookie'), context.cloudflare.env);

  // Destroy session if it exists
  if (sessionId) {
    await destroySession(db, sessionId);
  }

  // Redirect to login with cleared cookie
  return redirect('/login', {
    headers: {
      'Set-Cookie': createLogoutCookie(context.cloudflare.env),
    },
  });
}

/**
 * Loader - redirect GET requests to home
 * Logout should only happen via POST
 */
export function loader() {
  return redirect('/');
}
