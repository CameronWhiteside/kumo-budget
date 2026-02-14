import { Form, Link, useNavigation } from 'react-router';
import { Button, Input, Text, Table } from '@cloudflare/kumo';
import { PlusIcon, ArrowLeftIcon, TrashIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.tags';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, tagQueries } from '~/lib/db/queries';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `Tags - ${projectName} - Kumo Budget` },
    { name: 'description', content: `Manage tags for ${projectName}` },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'viewer');

  const project = await projectQueries.findById(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  const tags = await tagQueries.findByProject(db, projectId);

  return {
    user: { id: user.id, username: user.username },
    project,
    tags,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'create': {
      const name = formData.get('name');
      if (typeof name !== 'string' || !name.trim()) {
        return { error: 'Tag name is required' };
      }

      // Check if tag already exists
      const existing = await tagQueries.findByName(db, projectId, name.trim());
      if (existing) {
        return { error: 'Tag already exists' };
      }

      await tagQueries.create(db, { projectId, name: name.trim() });
      return { success: true };
    }

    case 'delete': {
      const tagId = Number(formData.get('tagId'));
      if (isNaN(tagId)) {
        return { error: 'Invalid tag ID' };
      }

      const tag = await tagQueries.findByIdAndProject(db, tagId, projectId);
      if (!tag) {
        return { error: 'Tag not found' };
      }

      await tagQueries.delete(db, tagId);
      return { success: true };
    }

    default:
      return { error: 'Unknown action' };
  }
}

export default function ProjectTags({ loaderData, actionData }: Route.ComponentProps) {
  const { user, project, tags } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  return (
    <AppShell user={user}>
      <div className="max-w-2xl mx-auto">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-2 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          <Text size="sm">Back to project</Text>
        </Link>

        <div className="mb-6">
          <Text variant="heading1" as="h1">
            Tags
          </Text>
          <div className="mt-1">
            <Text variant="secondary">{project.name}</Text>
          </div>
        </div>

        {actionData?.error && (
          <div className="mb-4">
            <Text variant="error">{actionData.error}</Text>
          </div>
        )}

        {/* Create tag form */}
        <Form method="post" className="flex items-end gap-2 mb-8">
          <input type="hidden" name="intent" value="create" />
          <div className="flex-1">
            <Input
              label="New tag"
              name="name"
              type="text"
              placeholder="e.g., groceries, utilities"
              required
              disabled={isSubmitting}
            />
          </div>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            <PlusIcon className="h-4 w-4 mr-2" />
            Add
          </Button>
        </Form>

        {/* Tags list */}
        {tags.length === 0 ? (
          <div className="py-8 text-center">
            <Text variant="secondary">No tags yet. Create one above.</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>Actions</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {tags.map((tag) => (
                <Table.Row key={tag.id}>
                  <Table.Cell>
                    <Text>{tag.name}</Text>
                  </Table.Cell>
                  <Table.Cell align="right">
                    <Form method="post" className="inline">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="tagId" value={tag.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={(e) => {
                          if (!confirm(`Delete tag "${tag.name}"?`)) {
                            e.preventDefault();
                          }
                        }}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </Form>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>
    </AppShell>
  );
}
