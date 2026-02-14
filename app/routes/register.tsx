import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';
import {
  Banner,
  BannerVariant,
  Button,
  Input,
  Link as KumoLink,
  Surface,
  Text,
} from '@cloudflare/kumo';

import type { Route } from './+types/register';
import { createDb } from '~/lib/db';
import { userQueries } from '~/lib/db/queries';
import {
  hashPassword,
  createSession,
  createSessionCookie,
  redirectIfAuthenticated,
} from '~/lib/auth';

export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Sign Up - Kumo Budget' },
    { name: 'description', content: 'Create a new account' },
  ];
}

export async function loader({ request, context }: Route.LoaderArgs) {
  await redirectIfAuthenticated(request, context.cloudflare.env);
  return null;
}

export async function action({ request, context }: Route.ActionArgs) {
  const formData = await request.formData();
  const username = formData.get('username');
  const password = formData.get('password');
  const confirmPassword = formData.get('confirmPassword');

  // Validate input
  if (
    typeof username !== 'string' ||
    typeof password !== 'string' ||
    typeof confirmPassword !== 'string'
  ) {
    return { error: 'Invalid form data' };
  }

  const trimmedUsername = username.trim();

  if (!trimmedUsername) {
    return { error: 'Username is required' };
  }

  if (trimmedUsername.length < 3) {
    return { error: 'Username must be at least 3 characters' };
  }

  if (trimmedUsername.length > 50) {
    return { error: 'Username must be 50 characters or less' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(trimmedUsername)) {
    return { error: 'Username can only contain letters, numbers, underscores, and hyphens' };
  }

  if (!password) {
    return { error: 'Password is required' };
  }

  if (password.length < 6) {
    return { error: 'Password must be at least 6 characters' };
  }

  if (password !== confirmPassword) {
    return { error: 'Passwords do not match' };
  }

  const db = createDb(context.cloudflare.env.DB);

  // Check if username already exists
  const existingUser = await userQueries.findByUsername(db, trimmedUsername);
  if (existingUser) {
    return { error: 'Username is already taken' };
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  const user = await userQueries.create(db, {
    id: crypto.randomUUID(),
    username: trimmedUsername,
    passwordHash,
  });

  // Create session and log them in
  const session = await createSession(db, user.id, context.cloudflare.env);

  // Redirect to home with session cookie
  return redirect('/', {
    headers: {
      'Set-Cookie': createSessionCookie(session.id, context.cloudflare.env),
    },
  });
}

export default function RegisterPage() {
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
              Create your account
            </Text>
          </div>
        </div>

        <Form method="post" className="space-y-4">
          {actionData?.error && <Banner variant={BannerVariant.ERROR}>{actionData.error}</Banner>}

          <Input
            label="Username"
            name="username"
            type="text"
            placeholder="Choose a username"
            autoComplete="username"
            required
            disabled={isSubmitting}
          />

          <Input
            label="Password"
            name="password"
            type="password"
            placeholder="Choose a password"
            autoComplete="new-password"
            required
            disabled={isSubmitting}
          />

          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
            disabled={isSubmitting}
          />

          <div className="pt-2">
            <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </Button>
          </div>
        </Form>

        <div className="mt-6 text-center">
          <Text variant="secondary" size="sm">
            Already have an account? <KumoLink render={<Link to="/login" />}>Sign in</KumoLink>
          </Text>
        </div>
      </Surface>
    </div>
  );
}
