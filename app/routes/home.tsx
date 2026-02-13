import { Form } from 'react-router';
import { Button, Surface, Text } from '@cloudflare/kumo';
import { CloudflareLogo } from '@cloudflare/kumo/components/cloudflare-logo';
import { SignOutIcon, UserIcon } from '@phosphor-icons/react/dist/ssr';

import type { Route } from './+types/home';
import { requireAuth } from '~/lib/auth';

/**
 * Home page meta information
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Home - Kumo Budget' },
    { name: 'description', content: 'Your personal budget tracker' },
  ];
}

/**
 * Loader - requires authentication
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  return { user: { id: user.id, username: user.username } };
}

/**
 * Protected home page component
 */
export default function Home({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <header className="bg-white dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <CloudflareLogo className="h-8 w-auto" />
              <Text as="span" size="lg" weight="semibold">
                Kumo Budget
              </Text>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-neutral-500" />
                <Text size="sm" className="text-neutral-600 dark:text-neutral-400">
                  {user.username}
                </Text>
              </div>

              <Form method="post" action="/logout">
                <Button type="submit" variant="secondary" size="sm">
                  <SignOutIcon className="h-4 w-4 mr-2" />
                  Sign out
                </Button>
              </Form>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Surface className="p-8 rounded-xl">
          <div className="text-center">
            <Text as="h1" size="2xl" weight="bold" className="mb-4">
              Welcome back, {user.username}!
            </Text>
            <Text as="p" size="md" className="text-neutral-500 dark:text-neutral-400 mb-8">
              You are now signed in to Kumo Budget. This is your protected home page.
            </Text>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <Surface className="p-6 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <Text as="h3" size="lg" weight="semibold" className="mb-2">
                  Dashboard
                </Text>
                <Text size="sm" className="text-neutral-500 dark:text-neutral-400">
                  View your financial overview and recent activity.
                </Text>
              </Surface>

              <Surface className="p-6 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <Text as="h3" size="lg" weight="semibold" className="mb-2">
                  Transactions
                </Text>
                <Text size="sm" className="text-neutral-500 dark:text-neutral-400">
                  Track your income and expenses with ease.
                </Text>
              </Surface>

              <Surface className="p-6 rounded-lg bg-neutral-50 dark:bg-neutral-800">
                <Text as="h3" size="lg" weight="semibold" className="mb-2">
                  Reports
                </Text>
                <Text size="sm" className="text-neutral-500 dark:text-neutral-400">
                  Generate insights from your spending habits.
                </Text>
              </Surface>
            </div>
          </div>
        </Surface>

        <div className="mt-8 text-center">
          <Text size="xs" className="text-neutral-400 dark:text-neutral-500">
            Built with React Router v7, Cloudflare Workers, D1, and Kumo UI
          </Text>
        </div>
      </main>
    </div>
  );
}
