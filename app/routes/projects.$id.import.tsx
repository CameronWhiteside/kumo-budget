import { useState } from 'react';
import { Form, Link, redirect, useNavigation, useSearchParams } from 'react-router';
import { Button, Input, Select, Text } from '@cloudflare/kumo';
import { ArrowLeftIcon, UploadIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.import';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, accountQueries, importBatchQueries } from '~/lib/db/queries';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `Import CSV - ${projectName} - Kumo Budget` },
    { name: 'description', content: `Import transactions from CSV into ${projectName}` },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const project = await projectQueries.findById(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  const accounts = await accountQueries.findByProject(db, projectId);

  return {
    user: { id: user.id, username: user.username },
    project,
    accounts,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);
  const bucket = context.cloudflare.env.BUCKET;

  const projectId = Number(params.id);
  if (isNaN(projectId)) {
    throw new Response('Invalid project ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const formData = await request.formData();
  const accountId = Number(formData.get('accountId'));
  const file = formData.get('file') as File | null;

  if (isNaN(accountId)) {
    return { error: 'Please select an account' };
  }

  // Verify account belongs to project
  const account = await accountQueries.findByIdAndProject(db, accountId, projectId);
  if (!account) {
    return { error: 'Account not found' };
  }

  if (!file || file.size === 0) {
    return { error: 'Please select a CSV file' };
  }

  // Create import batch
  const batch = await importBatchQueries.create(db, {
    projectId,
    accountId,
    filename: file.name,
    status: 'uploading',
  });

  // Upload to R2
  const r2Key = `imports/${projectId}/${batch.id}.csv`;
  const fileContent = await file.arrayBuffer();
  await bucket.put(r2Key, fileContent, {
    httpMetadata: {
      contentType: 'text/csv',
    },
  });

  // Update batch with R2 key and status
  const { importBatches } = await import('~/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  await db
    .update(importBatches)
    .set({ r2Key, status: 'mapping' })
    .where(eq(importBatches.id, batch.id));

  return redirect(`/projects/${projectId}/import/${batch.id}/map`);
}

export default function ImportCSV({ loaderData, actionData }: Route.ComponentProps) {
  const { user, project, accounts } = loaderData;
  const [searchParams] = useSearchParams();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const preselectedAccount = searchParams.get('account');
  const [selectedAccount, setSelectedAccount] = useState<string>(preselectedAccount ?? '');

  if (accounts.length === 0) {
    return (
      <AppShell user={user}>
        <div className="max-w-md mx-auto">
          <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-2 mb-6">
            <ArrowLeftIcon className="h-4 w-4" />
            <Text size="sm">Back to project</Text>
          </Link>

          <div className="mb-6">
            <Text variant="heading1" as="h1">
              Import CSV
            </Text>
          </div>

          <div className="py-8 text-center">
            <Text variant="secondary">
              You need to create an account first before importing transactions.
            </Text>
            <div className="mt-4">
              <Link to={`/projects/${project.id}/accounts/new`}>
                <Button variant="primary">Create Account</Button>
              </Link>
            </div>
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell user={user}>
      <div className="max-w-md mx-auto">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-2 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          <Text size="sm">Back to project</Text>
        </Link>

        <div className="mb-6">
          <Text variant="heading1" as="h1">
            Import CSV
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

        <Form method="post" encType="multipart/form-data" className="space-y-4">
          <input type="hidden" name="accountId" value={selectedAccount} />

          <Select
            label="Account"
            value={selectedAccount}
            onValueChange={(v) => {
              if (v) setSelectedAccount(v);
            }}
            disabled={isSubmitting}
            hideLabel={false}
            placeholder="Select an account"
          >
            {accounts.map((account) => (
              <Select.Option key={account.id} value={String(account.id)}>
                {account.name}
              </Select.Option>
            ))}
          </Select>

          <div>
            <Input
              label="CSV File"
              name="file"
              type="file"
              accept=".csv"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="pt-4">
            <Button type="submit" variant="primary" disabled={isSubmitting || !selectedAccount}>
              <UploadIcon className="h-4 w-4 mr-2" />
              Upload & Continue
            </Button>
          </div>
        </Form>
      </div>
    </AppShell>
  );
}
