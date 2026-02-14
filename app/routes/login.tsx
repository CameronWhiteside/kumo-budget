import { Form, redirect, useActionData, useNavigation } from 'react-router';
import { Banner, BannerVariant, Button, Input, Surface, Text } from '@cloudflare/kumo';

import type { Route } from './+types/login';
import { createDb } from '~/lib/db';
import { userQueries } from '~/lib/db/queries';
import {
  verifyPassword,
  createSession,
  createSessionCookie,
  redirectIfAuthenticated,
} from '~/lib/auth';

/**
 * Login page meta information
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Login - Kumo Budget' },
    { name: 'description', content: 'Sign in to your account' },
  ];
}

/**
 * Loader - redirects to home if already logged in
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  await redirectIfAuthenticated(request, context.cloudflare.env);
  return null;
}

/**
 * Action - handles login form submission
 */
export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');

  // Validate input
  if (typeof username !== 'string' || typeof password !== 'string') {
    return { error: 'Invalid form data' };
  }

  if (!username.trim() || !password.trim()) {
    return { error: 'Username and password are required' };
  }

  const db = createDb(context.cloudflare.env.DB);

  // Find user
  const user = await userQueries.findByUsername(db, username.trim());

  if (!user) {
    return { error: 'Invalid username or password' };
  }

  // Verify password
  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { error: 'Invalid username or password' };
  }

  // Create session
  const session = await createSession(db, user.id, context.cloudflare.env);

  // Redirect to home with session cookie
  return redirect('/', {
    headers: {
      'Set-Cookie': createSessionCookie(session.id, context.cloudflare.env),
    },
  });
}

/**
 * Login page component
 */
export default function LoginPage() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Surface className="w-full max-w-md p-8 rounded-xl shadow-lg">
        <div className="mb-8 text-center">
          <Text variant="heading2" as="h1">
            Kumo Budget
          </Text>
          <div className="mt-2">
            <Text variant="secondary" as="p" size="sm">
              Sign in to continue
            </Text>
          </div>
        </div>

        <Form method="post" className="space-y-4">
          {actionData?.error && <Banner variant={BannerVariant.ERROR}>{actionData.error}</Banner>}

          <Input
            label="Username"
            name="username"
            type="text"
            placeholder="Enter your username"
            autoComplete="username"
            required
            disabled={isSubmitting}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Enter your password"
            autoComplete="current-password"
            required
            disabled={isSubmitting}
          />

          <div className="pt-2">
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </Button>
          </div>
        </Form>

        <div className="mt-6 text-center">
          <Text variant="secondary" size="xs">
            Default credentials: admin / admin
          </Text>
        </div>
      </Surface>
    </div>
  );
}
