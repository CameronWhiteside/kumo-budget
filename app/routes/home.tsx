import { Link } from 'react-router';
import { Button, Surface, Text } from '@cloudflare/kumo';
import { FolderIcon } from '@phosphor-icons/react/dist/ssr';

import type { Route } from './+types/home';
import { requireAuth } from '~/lib/auth';
import { AppShell } from '~/components/AppShell';

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
    <AppShell user={user}>
      <Surface className="p-8 rounded-xl">
        <div className="mb-2">
          <Text variant="heading2" as="h1">
            Welcome back, {user.username}
          </Text>
        </div>
        <div className="mb-6">
          <Text variant="secondary" as="p">
            Manage your budget projects.
          </Text>
        </div>

        <Link to="/projects">
          <Button variant="primary">
            <FolderIcon className="h-5 w-5 mr-2" />
            View Projects
          </Button>
        </Link>
      </Surface>
    </AppShell>
  );
}
