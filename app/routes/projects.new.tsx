import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from 'react-router';
import { Button, Input, Label, Surface, Text } from '@cloudflare/kumo';

import type { Route } from './+types/projects.new';
import { AppShell } from '~/components/AppShell';
import { requireAuth } from '~/lib/auth';
import { createDb } from '~/lib/db';
import { projectQueries } from '~/lib/db/queries';
import type { Project } from '~/lib/db/schema';

/**
 * New project page meta information
 */
export function meta(): Route.MetaDescriptors {
  return [
    { title: 'New Project - Kumo Budget' },
    { name: 'description', content: 'Create a new budget project' },
  ];
}

/**
 * Loader - requires authentication and fetches user's projects for parent dropdown
 */
export async function loader({ request, context }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  // Fetch user's existing projects for parent dropdown
  const projects = await projectQueries.findUserProjects(db, user.id);

  // Check for parent query param
  const url = new URL(request.url);
  const parentId = url.searchParams.get('parent');

  return {
    projects,
    parentId: parentId ? parseInt(parentId, 10) : null,
    user: { id: user.id, username: user.username },
  };
}

/**
 * Action - handles project creation
 */
export async function action({ request, context }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const formData = await request.formData();
  const name = formData.get('name');
  const parentIdStr = formData.get('parentId');

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

  // Parse optional parent ID
  let parentId: number | null = null;
  if (typeof parentIdStr === 'string' && parentIdStr.trim()) {
    parentId = parseInt(parentIdStr, 10);
    if (isNaN(parentId)) {
      return { error: 'Invalid parent project', fieldErrors: {} };
    }

    // Verify user has access to parent project
    const parentProject = await projectQueries.findById(db, parentId);
    if (!parentProject) {
      return { error: 'Parent project not found', fieldErrors: {} };
    }
  }

  // Create the project
  const project = await projectQueries.create(db, {
    name: trimmedName,
    parentId,
    ownerId: user.id,
  });

  // Redirect to the new project
  return redirect(`/projects/${project.id}`);
}

/**
 * New project page component
 */
export default function NewProject({ loaderData }: Route.ComponentProps) {
  const { projects, parentId, user } = loaderData;
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isSubmitting = navigation.state === 'submitting';

  // Get default parent from URL or action data
  const parentParam = searchParams.get('parent');
  const defaultParentId = parentId ?? (parentParam ? parseInt(parentParam, 10) : '');

  return (
    <AppShell user={user}>
      <div className="max-w-2xl">
        <div className="mb-6">
          <Text variant="heading2" as="h1">
            New Project
          </Text>
        </div>

        <Surface className="p-8 rounded-xl">
          <Form method="post" className="space-y-4">
            {/* General error message */}
            {actionData?.error && !actionData.fieldErrors?.name && (
              <div className="p-3 rounded-lg border">
                <Text variant="error" size="sm">
                  {actionData.error}
                </Text>
              </div>
            )}

            {/* Project name input */}
            <div>
              <Label htmlFor="name">Project name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder="e.g., Home Budget, Vacation Fund"
                aria-describedby={actionData?.fieldErrors?.name ? 'name-error' : undefined}
                aria-invalid={actionData?.fieldErrors?.name ? 'true' : undefined}
                required
                disabled={isSubmitting}
                className="w-full"
              />
              {actionData?.fieldErrors?.name && (
                <div className="mt-1">
                  <Text variant="error" size="xs" id="name-error">
                    {actionData.fieldErrors.name}
                  </Text>
                </div>
              )}
            </div>

            {/* Parent project dropdown (optional) */}
            {projects.length > 0 && (
              <div>
                <Label htmlFor="parentId" showOptional>
                  Parent project
                </Label>
                <select
                  id="parentId"
                  name="parentId"
                  disabled={isSubmitting}
                  defaultValue={defaultParentId}
                  className="w-full px-3 py-2 rounded-lg border disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">None (top-level project)</option>
                  {projects.map((project: Project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <div className="mt-1">
                  <Text variant="secondary" size="xs">
                    Create this project as a sub-project of an existing project.
                  </Text>
                </div>
              </div>
            )}

            {/* Form actions */}
            <div className="flex items-center gap-3 pt-4">
              <Button type="submit" variant="primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating...' : 'Create Project'}
              </Button>
              <Link to="/projects">
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
