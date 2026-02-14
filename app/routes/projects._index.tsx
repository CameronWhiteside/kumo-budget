import { Link } from 'react-router';
import { Badge, Button, Empty, Grid, GridItem, Surface, Text } from '@cloudflare/kumo';
import { FolderIcon, FolderPlusIcon, TreeStructureIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';

import type { Route } from './+types/projects._index';
import { requireAuth } from '~/lib/auth';
import { createDb } from '~/lib/db';
import { projectQueries, projectMemberQueries } from '~/lib/db/queries';
import type { Project, ProjectRole } from '~/lib/db/schema';

/**
 * Projects list page meta information
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Projects - Kumo Budget' },
    { name: 'description', content: 'Manage your budget projects' },
  ];
}

/**
 * Project with role and child count for display
 */
interface ProjectWithDetails {
  project: Project;
  role: ProjectRole;
  childCount: number;
}

/**
 * Loader - requires authentication and fetches user's projects
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  // Get all projects user is a member of
  const projects = await projectQueries.findUserProjects(db, user.id);

  // Fetch role and child count for each project
  const projectsWithDetails: ProjectWithDetails[] = await Promise.all(
    projects.map(async (project) => {
      const role = await projectMemberQueries.getMemberRole(db, project.id, user.id);
      const children = await projectQueries.findChildren(db, project.id);
      return {
        project,
        role: role ?? 'viewer',
        childCount: children.length,
      };
    })
  );

  return { projects: projectsWithDetails, user: { id: user.id, username: user.username } };
}

/**
 * Role badge component using Kumo Badge
 */
function RoleBadge({ role }: { role: ProjectRole }) {
  const variant = role === 'owner' ? 'primary' : role === 'editor' ? 'secondary' : 'outline';
  return <Badge variant={variant}>{role}</Badge>;
}

/**
 * Projects list page component
 */
export default function ProjectsIndex({ loaderData }: Route.ComponentProps) {
  const { projects, user } = loaderData;

  return (
    <AppShell user={user}>
      {/* Page header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <FolderIcon className="h-6 w-6" />
          <Text variant="heading2" as="h1">
            Projects
          </Text>
        </div>

        <Link to="/projects/new">
          <Button variant="primary" size="sm">
            <FolderPlusIcon className="h-4 w-4 mr-2" />
            New Project
          </Button>
        </Link>
      </div>

      {projects.length === 0 ? (
        /* Empty state */
        <Surface className="p-12 rounded-xl">
          <Empty
            icon={<FolderIcon size={48} />}
            title="No projects yet"
            description="Create your first project to start tracking your budget."
            contents={
              <Link to="/projects/new">
                <Button variant="primary" icon={<FolderPlusIcon />}>
                  Create your first project
                </Button>
              </Link>
            }
          />
        </Surface>
      ) : (
        /* Projects grid */
        <Grid variant="3up" gap="base">
          {projects.map(({ project, role, childCount }) => (
            <GridItem key={project.id}>
              <Link to={`/projects/${project.id}`} className="block h-full">
                <Surface className="p-6 rounded-xl hover:shadow-md transition-shadow h-full">
                  <div className="flex items-start justify-between mb-3">
                    <FolderIcon className="h-8 w-8" />
                    <RoleBadge role={role} />
                  </div>

                  <div className="mb-2">
                    <Text variant="heading3" as="h3">
                      {project.name}
                    </Text>
                  </div>

                  <div className="flex items-center gap-4 mt-4">
                    {childCount > 0 && (
                      <div className="flex items-center gap-1">
                        <TreeStructureIcon className="h-4 w-4" />
                        <Text variant="secondary" size="sm">
                          {childCount} sub-project{childCount !== 1 ? 's' : ''}
                        </Text>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t">
                    <Text variant="secondary" size="xs">
                      Created {new Date(project.createdAt).toLocaleDateString()}
                    </Text>
                  </div>
                </Surface>
              </Link>
            </GridItem>
          ))}
        </Grid>
      )}
    </AppShell>
  );
}
