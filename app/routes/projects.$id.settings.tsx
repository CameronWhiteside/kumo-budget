import { useState } from 'react';
import { Form, redirect, useActionData, useNavigation, useSubmit } from 'react-router';
import { Banner, BannerVariant, Breadcrumbs, Button, Input, Select, Text } from '@cloudflare/kumo';
import { GearIcon, HouseIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';

import type { Route } from './+types/projects.$id.settings';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, projectMemberQueries } from '~/lib/db/queries';
import { PROJECT_ROLES, type ProjectRole, type ProjectMemberWithUser } from '~/lib/db/schema';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `Settings - ${projectName} - Kumo Budget` },
    { name: 'description', content: `Manage settings for ${projectName}` },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'owner');

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

type ActionResult = { success: true; message: string } | { success: false; error: string };

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

      if (!PROJECT_ROLES.includes(role)) {
        return { success: false, error: 'Invalid role' };
      }

      const targetUser = await projectMemberQueries.findUserByUsernameForProject(
        db,
        username.trim()
      );
      if (!targetUser) {
        return { success: false, error: `User "${username}" not found` };
      }

      const isMember = await projectMemberQueries.isMember(db, projectId, targetUser.id);
      if (isMember) {
        return { success: false, error: `User "${username}" is already a member` };
      }

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

      const currentRole = await projectMemberQueries.getMemberRole(db, projectId, memberUserId);
      if (!currentRole) {
        return { success: false, error: 'Member not found' };
      }

      if (currentRole === 'owner' && newRole !== 'owner') {
        const ownerCount = await projectMemberQueries.countOwners(db, projectId);
        if (ownerCount <= 1) {
          return {
            success: false,
            error: 'Cannot remove the last owner. Assign another owner first.',
          };
        }
      }

      await projectMemberQueries.updateRole(db, projectId, memberUserId, newRole);
      return { success: true, message: 'Role updated successfully' };
    }

    case 'removeMember': {
      const memberUserId = Number(formData.get('userId'));

      if (isNaN(memberUserId)) {
        return { success: false, error: 'Invalid user ID' };
      }

      const currentRole = await projectMemberQueries.getMemberRole(db, projectId, memberUserId);
      if (!currentRole) {
        return { success: false, error: 'Member not found' };
      }

      if (currentRole === 'owner') {
        const ownerCount = await projectMemberQueries.countOwners(db, projectId);
        if (ownerCount <= 1) {
          return { success: false, error: 'Cannot remove the last owner' };
        }
      }

      await projectMemberQueries.removeMember(db, projectId, memberUserId);
      return { success: true, message: 'Member removed successfully' };
    }

    case 'deleteProject': {
      await projectQueries.delete(db, projectId);
      return redirect('/projects');
    }

    default:
      return { success: false, error: 'Unknown action' };
  }
}

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
  const submit = useSubmit();

  const handleRoleChange = (newRole: string | null) => {
    if (!newRole) return;
    const formData = new FormData();
    formData.set('intent', 'updateRole');
    formData.set('userId', String(member.userId));
    formData.set('role', newRole);
    void submit(formData, { method: 'post' });
  };

  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex items-center gap-2">
        <Text bold>{member.user.username}</Text>
        {isCurrentUser && (
          <Text variant="secondary" size="sm">
            (you)
          </Text>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Select
          value={member.role}
          onValueChange={handleRoleChange}
          disabled={isSubmitting}
          hideLabel
          label={`Role for ${member.user.username}`}
        >
          {PROJECT_ROLES.map((role) => (
            <Select.Option key={role} value={role}>
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </Select.Option>
          ))}
        </Select>

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

export default function ProjectSettings({ loaderData }: Route.ComponentProps) {
  const { user, project, members } = loaderData;
  const actionData = useActionData<ActionResult>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [newMemberRole, setNewMemberRole] = useState<string>('viewer');

  return (
    <AppShell user={user}>
      <div className="max-w-2xl mx-auto">
        <div className="mb-6">
          <Breadcrumbs>
            <Breadcrumbs.Link icon={<HouseIcon size={16} />} href="/">
              Home
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link href={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current icon={<GearIcon size={16} />}>Settings</Breadcrumbs.Current>
          </Breadcrumbs>
        </div>

        <div className="mb-8">
          <Text variant="heading1" as="h1">
            Settings
          </Text>
        </div>

        {actionData && (
          <Banner variant={actionData.success ? BannerVariant.DEFAULT : BannerVariant.ERROR}>
            {actionData.success ? actionData.message : actionData.error}
          </Banner>
        )}

        {/* Members */}
        <div className="mb-10">
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
          <div className="mb-4">
            <Text variant="heading3" as="h3">
              Add member
            </Text>
          </div>
          <Form method="post" className="flex items-end gap-3">
            <input type="hidden" name="intent" value="addMember" />
            <input type="hidden" name="role" value={newMemberRole} />

            <div className="flex-1">
              <Input
                label="Username"
                name="username"
                type="text"
                placeholder="Enter username"
                required
                disabled={isSubmitting}
              />
            </div>

            <Select
              label="Role"
              value={newMemberRole}
              onValueChange={(v) => {
                if (v) setNewMemberRole(v);
              }}
              disabled={isSubmitting}
              hideLabel={false}
            >
              {PROJECT_ROLES.map((role) => (
                <Select.Option key={role} value={role}>
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </Select.Option>
              ))}
            </Select>

            <Button type="submit" variant="primary" disabled={isSubmitting}>
              <PlusIcon className="h-4 w-4 mr-2" />
              Add
            </Button>
          </Form>
        </div>

        {/* Delete */}
        <div className="pt-6">
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
