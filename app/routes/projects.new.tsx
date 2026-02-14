import { useState } from 'react';
import { Form, Link, redirect, useActionData, useNavigation, useSearchParams } from 'react-router';
import { Banner, BannerVariant, Button, Input, Select, Surface, Text } from '@cloudflare/kumo';

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
    parentId: parentId ?? null,
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
  let parentId: string | null = null;
  if (typeof parentIdStr === 'string' && parentIdStr.trim()) {
    parentId = parentIdStr.trim();

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
  const defaultParentId = String(parentId ?? (parentParam ? parseInt(parentParam, 10) : ''));
  const [selectedParent, setSelectedParent] = useState<string>(defaultParentId);

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
            <input type="hidden" name="parentId" value={selectedParent} />

            {/* General error message */}
            {actionData?.error && !actionData.fieldErrors?.name && (
              <Banner variant={BannerVariant.ERROR}>{actionData.error}</Banner>
            )}

            {/* Project name input */}
            <Input
              label="Project name"
              name="name"
              type="text"
              placeholder="e.g., Home Budget, Vacation Fund"
              aria-describedby={actionData?.fieldErrors?.name ? 'name-error' : undefined}
              aria-invalid={actionData?.fieldErrors?.name ? 'true' : undefined}
              required
              disabled={isSubmitting}
            />
            {actionData?.fieldErrors?.name && (
              <Banner variant={BannerVariant.ERROR}>{actionData.fieldErrors.name}</Banner>
            )}

            {/* Parent project dropdown (optional) */}
            {projects.length > 0 && (
              <Select
                label="Parent project (optional)"
                value={selectedParent}
                onValueChange={(v) => {
                  setSelectedParent(v ?? '');
                }}
                disabled={isSubmitting}
                hideLabel={false}
                placeholder="None (top-level project)"
                items={projects.map((project: Project) => ({
                  value: project.id,
                  label: project.name,
                }))}
              >
                {projects.map((project: Project) => (
                  <Select.Option key={project.id} value={project.id}>
                    {project.name}
                  </Select.Option>
                ))}
              </Select>
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
