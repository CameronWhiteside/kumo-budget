import { Form, Link } from 'react-router';
import { Button, Surface, Text } from '@cloudflare/kumo';
import { FolderIcon } from '@phosphor-icons/react/dist/ssr';
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
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="bg-white border-b border-neutral-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <CloudflareLogo className="h-8 w-auto" />
              <Text variant="heading3" as="span">
                Kumo Budget
              </Text>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <UserIcon className="h-5 w-5 text-neutral-500" />
                <Text variant="secondary" size="sm">
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
            <div className="mb-4">
              <Text variant="heading1" as="h1">
                Welcome back, {user.username}!
              </Text>
            </div>
            <div className="mb-8">
              <Text variant="secondary" as="p">
                You are now signed in to Kumo Budget. This is your protected home page.
              </Text>
            </div>

            <Link to="/projects">
              <Button variant="primary" size="lg">
                <FolderIcon className="h-5 w-5 mr-2" />
                View Projects
              </Button>
            </Link>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <Link to="/projects" className="block">
                <Surface className="p-6 rounded-lg bg-neutral-50 hover:bg-neutral-100 transition-colors">
                  <div className="mb-2">
                    <Text variant="heading3" as="h3">
                      Dashboard
                    </Text>
                  </div>
                  <Text variant="secondary" size="sm">
                    View your financial overview and recent activity.
                  </Text>
                </Surface>
              </Link>

              <Surface className="p-6 rounded-lg bg-neutral-50">
                <div className="mb-2">
                  <Text variant="heading3" as="h3">
                    Transactions
                  </Text>
                </div>
                <Text variant="secondary" size="sm">
                  Track your income and expenses with ease.
                </Text>
              </Surface>

              <Surface className="p-6 rounded-lg bg-neutral-50">
                <div className="mb-2">
                  <Text variant="heading3" as="h3">
                    Reports
                  </Text>
                </div>
                <Text variant="secondary" size="sm">
                  Generate insights from your spending habits.
                </Text>
              </Surface>
            </div>
          </div>
        </Surface>

        <div className="mt-8 text-center">
          <Text variant="secondary" size="xs">
            Built with React Router v7, Cloudflare Workers, D1, and Kumo UI
          </Text>
        </div>
      </main>
    </div>
  );
}
