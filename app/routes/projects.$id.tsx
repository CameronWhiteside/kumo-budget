import { Link } from 'react-router';
import { Button, Surface, Text } from '@cloudflare/kumo';
import {
  GearIcon,
  PlusIcon,
  UsersIcon,
  FolderIcon,
  HouseIcon,
  CaretRightIcon,
  UserIcon,
  BankIcon,
  TagIcon,
  UploadIcon,
} from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';

import type { Route } from './+types/projects.$id';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess, canEdit } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries } from '~/lib/db/queries';
import type { Project } from '~/lib/db/schema';

/**
 * Project detail page meta information
 */
export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `${projectName} - Kumo Budget` },
    { name: 'description', content: `View and manage ${projectName}` },
  ];
}

/**
 * Loader - requires authentication and project access
 */
export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  // Check user has at least viewer access
  const { role } = await requireProjectAccess(db, user.id, projectId, 'viewer');

  // Fetch project with members
  const project = await projectQueries.findByIdWithMembers(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  // Fetch child projects (sub-projects)
  const children = await projectQueries.findChildren(db, projectId);

  // Fetch ancestors for breadcrumbs
  const ancestors = await projectQueries.findAncestors(db, projectId);

  return {
    user: { id: user.id, username: user.username },
    project,
    children,
    ancestors,
    role,
    canEdit: canEdit(role),
    isOwner: role === 'owner',
  };
}

/**
 * Breadcrumb navigation component
 */
function Breadcrumbs({ ancestors, current }: { ancestors: Project[]; current: Project }) {
  return (
    <nav className="flex items-center gap-2 text-sm" aria-label="Breadcrumb">
      <Link to="/">
        <HouseIcon className="h-4 w-4" />
      </Link>

      {ancestors.map((ancestor) => (
        <div key={ancestor.id} className="flex items-center gap-2">
          <CaretRightIcon className="h-3 w-3" />
          <Link to={`/projects/${ancestor.id}`}>{ancestor.name}</Link>
        </div>
      ))}

      <CaretRightIcon className="h-3 w-3" />
      <Text variant="secondary" size="sm" bold>
        {current.name}
      </Text>
    </nav>
  );
}

/**
 * Sub-project card component
 */
function SubProjectCard({ project }: { project: Project }) {
  return (
    <Link to={`/projects/${project.id}`}>
      <Surface className="p-6 rounded-lg transition-colors">
        <div className="flex items-start gap-3">
          <FolderIcon className="h-6 w-6 flex-shrink-0" />
          <div>
            <div className="mb-1">
              <Text variant="heading3" as="h3">
                {project.name}
              </Text>
            </div>
            <Text variant="secondary" size="sm">
              Created {new Date(project.createdAt).toLocaleDateString()}
            </Text>
          </div>
        </div>
      </Surface>
    </Link>
  );
}

/**
 * Project detail page component
 */
export default function ProjectDetail({ loaderData }: Route.ComponentProps) {
  const { user, project, children, ancestors, canEdit: userCanEdit, isOwner } = loaderData;

  const memberCount = project.members.length;
  const subProjectCount = children.length;

  return (
    <AppShell user={user}>
      {/* Breadcrumbs */}
      <div className="mb-6">
        <Breadcrumbs ancestors={ancestors} current={project} />
      </div>

      {/* Project header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="mb-2">
            <Text variant="heading1" as="h1">
              {project.name}
            </Text>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <UsersIcon className="h-4 w-4" />
              <Text variant="secondary" size="sm">
                {memberCount} {memberCount === 1 ? 'member' : 'members'}
              </Text>
            </div>
            <div className="flex items-center gap-1">
              <FolderIcon className="h-4 w-4" />
              <Text variant="secondary" size="sm">
                {subProjectCount} {subProjectCount === 1 ? 'sub-project' : 'sub-projects'}
              </Text>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {userCanEdit && (
            <Link to={`/projects/${project.id}/new`}>
              <Button variant="secondary">
                <PlusIcon className="h-4 w-4 mr-2" />
                New Sub-project
              </Button>
            </Link>
          )}

          {isOwner && (
            <Link to={`/projects/${project.id}/settings`}>
              <Button variant="secondary">
                <GearIcon className="h-4 w-4 mr-2" />
                Settings
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Sub-projects section */}
      <Surface className="p-8 rounded-xl">
        <div className="flex items-center justify-between mb-6">
          <Text variant="heading2" as="h2">
            Sub-projects
          </Text>
        </div>

        {children.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {children.map((child) => (
              <SubProjectCard key={child.id} project={child} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FolderIcon className="h-12 w-12 mx-auto mb-4" />
            <div className="mb-4">
              <Text variant="secondary" as="p">
                No sub-projects yet
              </Text>
            </div>
            {userCanEdit && (
              <Link to={`/projects/${project.id}/new`}>
                <Button variant="primary">
                  <PlusIcon className="h-4 w-4 mr-2" />
                  Create Sub-project
                </Button>
              </Link>
            )}
          </div>
        )}
      </Surface>

      {/* Financial tracking section */}
      <Surface className="p-8 rounded-xl mt-6">
        <div className="mb-6">
          <Text variant="heading2" as="h2">
            Financial Tracking
          </Text>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link to={`/projects/${project.id}/accounts`}>
            <Surface className="p-6 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <BankIcon className="h-6 w-6" />
                <div>
                  <Text variant="heading3" as="h3">
                    Accounts
                  </Text>
                  <Text variant="secondary" size="sm">
                    View and manage financial accounts
                  </Text>
                </div>
              </div>
            </Surface>
          </Link>

          <Link to={`/projects/${project.id}/tags`}>
            <Surface className="p-6 rounded-lg transition-colors">
              <div className="flex items-center gap-3">
                <TagIcon className="h-6 w-6" />
                <div>
                  <Text variant="heading3" as="h3">
                    Tags
                  </Text>
                  <Text variant="secondary" size="sm">
                    Categorize transactions with tags
                  </Text>
                </div>
              </div>
            </Surface>
          </Link>

          {userCanEdit && (
            <Link to={`/projects/${project.id}/import`}>
              <Surface className="p-6 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <UploadIcon className="h-6 w-6" />
                  <div>
                    <Text variant="heading3" as="h3">
                      Import CSV
                    </Text>
                    <Text variant="secondary" size="sm">
                      Import transactions from bank exports
                    </Text>
                  </div>
                </div>
              </Surface>
            </Link>
          )}
        </div>
      </Surface>

      {/* Members quick view */}
      <Surface className="p-8 rounded-xl mt-6">
        <div className="flex items-center justify-between mb-6">
          <Text variant="heading2" as="h2">
            Members
          </Text>
          {isOwner && (
            <Link to={`/projects/${project.id}/settings`}>
              <Button variant="secondary" size="sm">
                Manage Members
              </Button>
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {project.members.map((member) => (
            <div key={member.userId} className="flex items-center gap-2 px-3 py-2 rounded-full">
              <UserIcon className="h-4 w-4" />
              <Text size="sm">{member.user.username}</Text>
              <Text variant="secondary" size="sm">
                ({member.role})
              </Text>
            </div>
          ))}
        </div>
      </Surface>
    </AppShell>
  );
}
