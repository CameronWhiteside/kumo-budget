import { Form, Link, redirect, useActionData, useNavigation } from 'react-router';
import { Button, Input, Label, Surface, Text } from '@cloudflare/kumo';

import type { Route } from './+types/projects.$id.new';
import { AppShell } from '~/components/AppShell';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess, canEdit } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries } from '~/lib/db/queries';

/**
 * New sub-project page meta information
 */
export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const parentName = loaderData?.parentProject?.name ?? 'Project';
  return [
    { title: `New Sub-project - ${parentName} - Kumo Budget` },
    { name: 'description', content: `Create a new sub-project under ${parentName}` },
  ];
}

/**
 * Loader - requires authentication and editor access to parent project
 */
export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const parentId = Number(params.id);
  if (isNaN(parentId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  // Require at least editor access to create sub-projects
  const { role } = await requireProjectAccess(db, user.id, parentId, 'editor');

  // Fetch parent project
  const parentProject = await projectQueries.findById(db, parentId);
  if (!parentProject) {
    throw new Response('Project not found', { status: 404 });
  }

  return {
    parentProject,
    user: { id: user.id, username: user.username },
    canEdit: canEdit(role),
  };
}

/**
 * Action - handles sub-project creation
 */
export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const parentId = Number(params.id);
  if (isNaN(parentId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  // Verify editor access to parent
  await requireProjectAccess(db, user.id, parentId, 'editor');

  const formData = await request.formData();
  const name = formData.get('name');

  // Validate name
  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Project name is required', fieldErrors: { name: 'Project name is required' } };
  }

  const trimmedName = name.trim();

  if (trimmedName.length > 100) {
    return {
      error: 'Project name must be 100 characters or less',
      fieldErrors: { name: 'Project name must be 100 characters or less' },
    };
  }

  // Create the sub-project
  const project = await projectQueries.create(db, {
    name: trimmedName,
    parentId,
    ownerId: user.id,
  });

  // Redirect to the new project
  return redirect(`/projects/${project.id}`);
}

/**
 * New sub-project page component
 */
export default function NewSubProject({ loaderData }: Route.ComponentProps) {
  const { parentProject, user } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <AppShell user={user}>
      <div className="max-w-2xl">
        <div className="mb-6">
          <Text variant="heading2" as="h1">
            New Sub-project
          </Text>
        </div>

        <Surface className="p-6 rounded-xl">
          <div className="mb-6">
            <Text variant="secondary" size="sm">
              Creating sub-project under
            </Text>
            <Text variant="heading3" as="p">
              {parentProject.name}
            </Text>
          </div>

          <Form method="post" className="space-y-4">
            {actionData?.error && !actionData.fieldErrors?.name && (
              <div className="p-3 rounded-lg">
                <Text variant="error" size="sm">
                  {actionData.error}
                </Text>
              </div>
            )}

            <div>
              <Label htmlFor="name">Sub-project name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="e.g., Q1 Budget, Marketing Expenses"
                aria-describedby={actionData?.fieldErrors?.name ? 'name-error' : undefined}
                aria-invalid={actionData?.fieldErrors?.name ? 'true' : undefined}
                required
                disabled={isSubmitting}
                className="w-full"
              />
              {actionData?.fieldErrors?.name && (
                <div id="name-error" className="mt-1">
                  <Text variant="error" size="xs">
                    {actionData.fieldErrors.name}
                  </Text>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create'}
              </Button>
              <Link to={`/projects/${parentProject.id}`}>
                <Button type="button" variant="secondary" disabled={isSubmitting}>
                  Cancel
                </Button>
              </Link>
            </div>
          </Form>
        </Surface>
      </div>
    </AppShell>
  );
}
