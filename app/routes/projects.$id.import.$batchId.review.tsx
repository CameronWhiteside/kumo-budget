import { useState } from 'react';
import { Form, redirect, useNavigation, useFetcher } from 'react-router';
import {
  Banner,
  BannerVariant,
  Breadcrumbs,
  Button,
  Checkbox,
  Table,
  Text,
} from '@cloudflare/kumo';
import {
  CheckIcon,
  HouseIcon,
  SparkleIcon,
  UploadIcon,
  WarningIcon,
} from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.import.$batchId.review';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import {
  projectQueries,
  accountQueries,
  importBatchQueries,
  importBatchRowQueries,
  tagQueries,
  transactionQueries,
} from '~/lib/db/queries';
import type { ImportBatchRow, Tag } from '~/lib/db/schema';

export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Review Import - Kumo Budget' },
    { name: 'description', content: 'Review and tag transactions before importing' },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = params.id;
  const batchId = params.batchId;

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const project = await projectQueries.findById(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  const batch = await importBatchQueries.findByIdAndProject(db, batchId, projectId);
  if (!batch) {
    throw new Response('Import batch not found', { status: 404 });
  }

  const account = await accountQueries.findById(db, batch.accountId);
  const rows = await importBatchRowQueries.findByBatch(db, batchId);
  const tags = await tagQueries.findByProject(db, projectId);

  return {
    user: { id: user.id, username: user.username },
    project,
    batch,
    account,
    rows,
    tags,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);
  const bucket = context.cloudflare.env.BUCKET;

  const projectId = params.id;
  const batchId = params.batchId;

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const batch = await importBatchQueries.findByIdAndProject(db, batchId, projectId);
  if (!batch) {
    throw new Response('Batch not found', { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'toggleExclude': {
      const rowId = Number(formData.get('rowId'));
      const excluded = formData.get('excluded') === 'true';
      if (!isNaN(rowId)) {
        await importBatchRowQueries.updateExcluded(db, rowId, excluded);
      }
      return { success: true };
    }

    case 'updateTags': {
      const rowId = Number(formData.get('rowId'));
      const tagIdsStr = formData.get('tagIds') as string;
      const tagIds: number[] = tagIdsStr ? (JSON.parse(tagIdsStr) as number[]) : [];
      if (!isNaN(rowId)) {
        await importBatchRowQueries.updateTags(db, rowId, tagIds);
      }
      return { success: true };
    }

    case 'commit': {
      // Get non-excluded rows
      const rows = await importBatchRowQueries.getNonExcluded(db, batchId);

      if (rows.length === 0) {
        return { error: 'No rows to import' };
      }

      // Create transactions
      const transactionData = rows.map((row) => ({
        projectId,
        accountId: batch.accountId,
        amount: row.parsedAmount ?? 0,
        date: row.parsedDate ?? new Date().toISOString().split('T')[0],
        description: row.parsedDescription ?? '',
        sourceHash: row.sourceHash,
        importBatchId: batchId,
      }));

      // Build tag map
      const tagIdsByIndex = new Map<number, number[]>();
      rows.forEach((row, index) => {
        if (row.tagIds) {
          try {
            const tagIds = JSON.parse(row.tagIds) as number[];
            if (tagIds.length > 0) {
              tagIdsByIndex.set(index, tagIds);
            }
          } catch {
            // Ignore parse errors
          }
        }
      });

      await transactionQueries.createMany(db, transactionData, tagIdsByIndex);

      // Delete batch rows
      await importBatchRowQueries.deleteByBatch(db, batchId);

      // Delete CSV from R2
      if (batch.r2Key) {
        await bucket.delete(batch.r2Key);
      }

      // Mark batch as completed
      await importBatchQueries.updateStatus(db, batchId, 'completed', new Date().toISOString());
      await importBatchQueries.clearR2Key(db, batchId);

      return redirect(`/projects/${projectId}/accounts/${batch.accountId}`);
    }

    default:
      return { error: 'Unknown action' };
  }
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

function RowTagSelector({ row, tags }: { row: ImportBatchRow; tags: Tag[] }) {
  const fetcher = useFetcher();
  const currentTagIds: number[] = row.tagIds ? (JSON.parse(row.tagIds) as number[]) : [];

  const handleTagToggle = (tagId: number, checked: boolean) => {
    const newTagIds = checked
      ? [...currentTagIds, tagId]
      : currentTagIds.filter((id) => id !== tagId);

    void fetcher.submit(
      {
        intent: 'updateTags',
        rowId: row.id,
        tagIds: JSON.stringify(newTagIds),
      },
      { method: 'post' }
    );
  };

  if (tags.length === 0) {
    return (
      <Text variant="secondary" size="sm">
        No tags
      </Text>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <label key={tag.id} className="inline-flex items-center gap-1 cursor-pointer">
          <Checkbox
            checked={currentTagIds.includes(tag.id)}
            onCheckedChange={(checked) => {
              handleTagToggle(tag.id, checked);
            }}
          />
          <Text size="sm">{tag.name}</Text>
        </label>
      ))}
    </div>
  );
}

export default function ReviewImport({ loaderData, actionData }: Route.ComponentProps) {
  const { user, project, batch, account, rows, tags } = loaderData;
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const isSubmitting = navigation.state === 'submitting';
  const [aiLoading, setAiLoading] = useState(false);

  const includedRows = rows.filter((r) => !r.excluded);
  const duplicateCount = rows.filter((r) => r.isDuplicate).length;

  const handleToggleExclude = (row: ImportBatchRow) => {
    void fetcher.submit(
      {
        intent: 'toggleExclude',
        rowId: row.id,
        excluded: String(!row.excluded),
      },
      { method: 'post' }
    );
  };

  const handleSuggestTags = () => {
    setAiLoading(true);
    fetch(`/projects/${project.id}/import/${batch.id}/suggest-tags`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rows: rows
          .filter((r) => !r.excluded)
          .map((r) => ({
            id: r.id,
            description: r.parsedDescription,
            amount: r.parsedAmount,
          })),
      }),
    })
      .then((response) => {
        if (response.ok) {
          window.location.reload();
        }
      })
      .catch((error: unknown) => {
        console.error('Failed to suggest tags:', error);
      })
      .finally(() => {
        setAiLoading(false);
      });
  };

  return (
    <AppShell user={user}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <Breadcrumbs>
            <Breadcrumbs.Link icon={<HouseIcon size={16} />} href="/">
              Home
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link href={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link
              icon={<UploadIcon size={16} />}
              href={`/projects/${project.id}/import`}
            >
              Import
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current>Review</Breadcrumbs.Current>
          </Breadcrumbs>
        </div>

        <div className="flex items-start justify-between mb-6">
          <div>
            <Text variant="heading1" as="h1">
              Review Import
            </Text>
            <div className="mt-1">
              <Text variant="secondary">
                {batch.filename} → {account?.name}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {tags.length > 0 && (
              <Button
                variant="secondary"
                onClick={handleSuggestTags}
                disabled={aiLoading || isSubmitting}
                icon={<SparkleIcon />}
              >
                {aiLoading ? 'Suggesting...' : 'Suggest Tags'}
              </Button>
            )}

            <Form method="post">
              <input type="hidden" name="intent" value="commit" />
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting || includedRows.length === 0}
                icon={<CheckIcon />}
              >
                Import {includedRows.length} Transactions
              </Button>
            </Form>
          </div>
        </div>

        {actionData?.error && <Banner variant={BannerVariant.ERROR}>{actionData.error}</Banner>}

        {duplicateCount > 0 && (
          <Banner variant={BannerVariant.ALERT} icon={<WarningIcon />}>
            {duplicateCount} potential duplicate(s) detected (already imported)
          </Banner>
        )}

        <div className="mb-2">
          <Text variant="secondary" size="sm">
            {includedRows.length} of {rows.length} rows will be imported
          </Text>
        </div>

        <Table>
          <Table.Header>
            <Table.Row>
              <Table.Head>Include</Table.Head>
              <Table.Head>Date</Table.Head>
              <Table.Head>Description</Table.Head>
              <Table.Head>Tags</Table.Head>
              <Table.Head>Amount</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {rows.map((row) => (
              <Table.Row key={row.id}>
                <Table.Cell>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={!row.excluded}
                      onCheckedChange={() => {
                        handleToggleExclude(row);
                      }}
                    />
                    {row.isDuplicate && <WarningIcon className="h-4 w-4" />}
                  </div>
                </Table.Cell>
                <Table.Cell>
                  <Text size="sm">{row.parsedDate}</Text>
                </Table.Cell>
                <Table.Cell>
                  <Text size="sm">{row.parsedDescription}</Text>
                </Table.Cell>
                <Table.Cell>
                  <RowTagSelector row={row} tags={tags} />
                </Table.Cell>
                <Table.Cell>
                  <Text size="sm">{formatCents(row.parsedAmount ?? 0)}</Text>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table>
      </div>
    </AppShell>
  );
}
