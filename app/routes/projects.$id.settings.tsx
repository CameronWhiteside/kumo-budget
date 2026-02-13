import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';
import { Button, Input, Label, Text } from '@cloudflare/kumo';
import { ArrowLeftIcon, TrashIcon, PlusIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';

import type { Route } from './+types/projects.$id.settings';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, projectMemberQueries } from '~/lib/db/queries';
import { PROJECT_ROLES, type ProjectRole, type ProjectMemberWithUser } from '~/lib/db/schema';

/**
 * Project settings page meta information
 */
export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `Settings - ${projectName} - Kumo Budget` },
    { name: 'description', content: `Manage settings for ${projectName}` },
  ];
}

/**
 * Loader - requires authentication and owner role
 */
export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  // Require owner role for settings access
  await requireProjectAccess(db, user.id, projectId, 'owner');

  // Fetch project with members
  const project = await projectQueries.findByIdWithMembers(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  return {
    user: { id: user.id, username: user.username },
    project,
    members: project.members,
  };
}

/**
 * Action result types
 */
type ActionResult = { success: true; message: string } | { success: false; error: string };

/**
 * Action - handles multiple intents via hidden field
 */
export async function action({
  request,
  context,
  params,
}: Route.ActionArgs): Promise<ActionResult | Response> {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  // Verify owner access
  await requireProjectAccess(db, user.id, projectId, 'owner');

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'addMember': {
      const username = formData.get('username');
      const role = (formData.get('role') as ProjectRole) || 'viewer';

      if (typeof username !== 'string' || !username.trim()) {
        return { success: false, error: 'Username is required' };
      }

      // Validate role
      if (!PROJECT_ROLES.includes(role)) {
        return { success: false, error: 'Invalid role' };
      }

      // Find user by username
      const targetUser = await projectMemberQueries.findUserByUsernameForProject(
        db,
        username.trim()
      );
      if (!targetUser) {
        return { success: false, error: `User "${username}" not found` };
      }

      // Check if already a member
      const isMember = await projectMemberQueries.isMember(db, projectId, targetUser.id);
      if (isMember) {
        return { success: false, error: `User "${username}" is already a member` };
      }

      // Add member
      await projectMemberQueries.addMember(db, projectId, targetUser.id, role);
      return { success: true, message: `Added ${username} as ${role}` };
    }

    case 'updateRole': {
      const memberUserId = Number(formData.get('userId'));
      const newRole = formData.get('role') as ProjectRole;

      if (isNaN(memberUserId)) {
        return { success: false, error: 'Invalid user ID' };
      }

      if (!PROJECT_ROLES.includes(newRole)) {
        return { success: false, error: 'Invalid role' };
      }

      // Get current member info
      const currentRole = await projectMemberQueries.getMemberRole(db, projectId, memberUserId);
      if (!currentRole) {
        return { success: false, error: 'Member not found' };
      }

      // If changing from owner to non-owner, check owner count
      if (currentRole === 'owner' && newRole !== 'owner') {
        const ownerCount = await projectMemberQueries.countOwners(db, projectId);
        if (ownerCount <= 1) {
          return {
            success: false,
            error: 'Cannot remove the last owner. Assign another owner first.',
          };
        }
      }

      // Update role
      await projectMemberQueries.updateRole(db, projectId, memberUserId, newRole);
      return { success: true, message: 'Role updated successfully' };
    }

    case 'removeMember': {
      const memberUserId = Number(formData.get('userId'));

      if (isNaN(memberUserId)) {
        return { success: false, error: 'Invalid user ID' };
      }

      // Get current member info
      const currentRole = await projectMemberQueries.getMemberRole(db, projectId, memberUserId);
      if (!currentRole) {
        return { success: false, error: 'Member not found' };
      }

      // If removing an owner, check owner count
      if (currentRole === 'owner') {
        const ownerCount = await projectMemberQueries.countOwners(db, projectId);
        if (ownerCount <= 1) {
          return { success: false, error: 'Cannot remove the last owner' };
        }
      }

      // Remove member
      await projectMemberQueries.removeMember(db, projectId, memberUserId);
      return { success: true, message: 'Member removed successfully' };
    }

    case 'deleteProject': {
      // Delete the project (cascades to children and members via FK)
      await projectQueries.delete(db, projectId);
      return redirect('/projects');
    }

    default:
      return { success: false, error: 'Unknown action' };
  }
}

/**
 * Member row component with role dropdown and remove button
 */
function MemberRow({
  member,
  currentUserId,
  isSubmitting,
}: {
  member: ProjectMemberWithUser;
  currentUserId: number;
  isSubmitting: boolean;
}) {
  const isCurrentUser = member.userId === currentUserId;

  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <Text bold>{member.user.username}</Text>
        {isCurrentUser && (
          <Text variant="secondary" size="sm">
            (you)
          </Text>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Form method="post" className="flex items-center">
          <input type="hidden" name="intent" value="updateRole" />
          <input type="hidden" name="userId" value={member.userId} />
          <select
            name="role"
            defaultValue={member.role}
            onChange={(e) => e.target.form?.requestSubmit()}
            disabled={isSubmitting}
            aria-label={`Role for ${member.user.username}`}
          >
            {PROJECT_ROLES.map((role) => (
              <option key={role} value={role}>
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </option>
            ))}
          </select>
        </Form>

        <Form method="post">
          <input type="hidden" name="intent" value="removeMember" />
          <input type="hidden" name="userId" value={member.userId} />
          <Button
            type="submit"
            variant="ghost"
            size="sm"
            disabled={isSubmitting}
            onClick={(e) => {
              if (!confirm(`Remove ${member.user.username} from this project?`)) {
                e.preventDefault();
              }
            }}
          >
            <TrashIcon className="h-4 w-4" />
          </Button>
        </Form>
      </div>
    </div>
  );
}

/**
 * Project settings page component
 */
export default function ProjectSettings({ loaderData }: Route.ComponentProps) {
  const { user, project, members } = loaderData;
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <AppShell user={user}>
      <div className="max-w-2xl mx-auto">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-2 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          <Text size="sm">Back to project</Text>
        </Link>

        <div className="mb-1">
          <Text variant="heading1" as="h1">
            Settings
          </Text>
        </div>
        <div className="mb-8">
          <Text variant="secondary">{project.name}</Text>
        </div>

        {actionData && (
          <div className="mb-6">
            <Text variant={actionData.success ? 'secondary' : 'error'} size="sm">
              {actionData.success ? actionData.message : actionData.error}
            </Text>
          </div>
        )}

        {/* Members */}
        <div className="mb-8">
          <div className="mb-4">
            <Text variant="heading2" as="h2">
              Members
            </Text>
          </div>

          <div className="mb-6">
            {members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                currentUserId={user.id}
                isSubmitting={isSubmitting}
              />
            ))}
          </div>

          {/* Add member */}
          <Form method="post" className="flex items-end gap-2">
            <input type="hidden" name="intent" value="addMember" />

            <div className="flex-1">
              <Label htmlFor="username">Add member</Label>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Username"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <Label htmlFor="role">Role</Label>
              <select id="role" name="role" defaultValue="viewer" disabled={isSubmitting}>
                {PROJECT_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <Button type="submit" variant="secondary" disabled={isSubmitting}>
              <PlusIcon className="h-4 w-4" />
            </Button>
          </Form>
        </div>

        {/* Delete */}
        <div className="pt-8">
          <div className="mb-2">
            <Text variant="heading2" as="h2">
              Delete project
            </Text>
          </div>
          <div className="mb-4">
            <Text variant="secondary" size="sm">
              This will permanently delete {project.name} and all sub-projects.
            </Text>
          </div>

          <Form method="post">
            <input type="hidden" name="intent" value="deleteProject" />
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting}
              onClick={(e) => {
                if (
                  !confirm(
                    `Are you sure you want to delete "${project.name}"? This cannot be undone.`
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              <TrashIcon className="h-4 w-4 mr-2" />
              Delete
            </Button>
          </Form>
        </div>
      </div>
    </AppShell>
  );
}
