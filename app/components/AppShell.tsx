import { Form, Link, NavLink } from 'react-router';
import { Button, Text } from '@cloudflare/kumo';
import { FolderIcon, HouseIcon, SignOutIcon } from '@phosphor-icons/react/dist/ssr';

interface AppShellProps {
  children: React.ReactNode;
  user?: { id: number; username: string };
}

/**
 * Main application shell with consistent header navigation.
 * Used by all authenticated pages.
 */
export function AppShell({ children, user }: AppShellProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            {/* Left: Logo + Nav */}
            <div className="flex items-center gap-6">
              <Link to="/" className="font-semibold text-lg">
                Kumo Budget
              </Link>

              {user && (
                <nav className="flex items-center gap-1">
                  <NavLink
                    to="/"
                    end
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded text-sm ${isActive ? 'font-medium' : ''}`
                    }
                  >
                    <HouseIcon className="h-4 w-4" />
                    Home
                  </NavLink>
                  <NavLink
                    to="/projects"
                    className={({ isActive }) =>
                      `flex items-center gap-2 px-3 py-1.5 rounded text-sm ${isActive ? 'font-medium' : ''}`
                    }
                  >
                    <FolderIcon className="h-4 w-4" />
                    Projects
                  </NavLink>
                </nav>
              )}
            </div>

            {/* Right: User + Logout */}
            {user && (
              <div className="flex items-center gap-4">
                <Text size="sm">{user.username}</Text>
                <Form method="post" action="/logout">
                  <Button type="submit" variant="ghost" size="sm">
                    <SignOutIcon className="h-4 w-4" />
                  </Button>
                </Form>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>
    </div>
  );
}
