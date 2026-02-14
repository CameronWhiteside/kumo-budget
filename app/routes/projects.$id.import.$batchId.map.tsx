import { useState, useEffect } from 'react';
import { Form, Link, redirect, useNavigation } from 'react-router';
import { Button, Select, Text, Table } from '@cloudflare/kumo';
import { ArrowLeftIcon, ArrowRightIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.import.$batchId.map';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import {
  projectQueries,
  importBatchQueries,
  importBatchRowQueries,
  transactionQueries,
  type ColumnMapping,
} from '~/lib/db/queries';

export function meta(): Route.MetaDescriptors {
  return [
    { title: 'Map Columns - Kumo Budget' },
    { name: 'description', content: 'Map CSV columns to transaction fields' },
  ];
}

function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser - handles basic cases
  const parseLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);

  return { headers, rows };
}

function hashString(str: string): string {
  // Simple hash for demo - in production use crypto.subtle.digest
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);
  const bucket = context.cloudflare.env.BUCKET;

  const projectId = Number(params.id);
  const batchId = Number(params.batchId);
  if (isNaN(projectId) || isNaN(batchId)) {
    throw new Response('Invalid ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const project = await projectQueries.findById(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  const batch = await importBatchQueries.findByIdAndProject(db, batchId, projectId);
  if (!batch) {
    throw new Response('Import batch not found', { status: 404 });
  }

  if (!batch.r2Key) {
    throw new Response('CSV file not found', { status: 404 });
  }

  // Fetch CSV from R2
  const r2Object = await bucket.get(batch.r2Key);
  if (!r2Object) {
    throw new Response('CSV file not found in storage', { status: 404 });
  }

  const csvContent = await r2Object.text();
  const { headers, rows } = parseCSV(csvContent);

  // Get preview rows (first 5)
  const previewRows = rows.slice(0, 5);

  return {
    user: { id: user.id, username: user.username },
    project,
    batch,
    headers,
    previewRows,
    totalRows: rows.length,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);
  const bucket = context.cloudflare.env.BUCKET;

  const projectId = Number(params.id);
  const batchId = Number(params.batchId);
  if (isNaN(projectId) || isNaN(batchId)) {
    throw new Response('Invalid ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const batch = await importBatchQueries.findByIdAndProject(db, batchId, projectId);
  if (!batch?.r2Key) {
    throw new Response('Batch not found', { status: 404 });
  }

  const formData = await request.formData();
  const dateColumn = formData.get('dateColumn') as string;
  const amountColumn = formData.get('amountColumn') as string;
  const descriptionColumn = formData.get('descriptionColumn') as string;

  if (!dateColumn || !amountColumn || !descriptionColumn) {
    return { error: 'Please map all required columns' };
  }

  const columnMapping: ColumnMapping = {
    date: dateColumn,
    amount: amountColumn,
    description: descriptionColumn,
  };

  // Save column mapping
  await importBatchQueries.updateColumnMapping(db, batchId, columnMapping);

  // Parse CSV and create batch rows
  const r2Object = await bucket.get(batch.r2Key);
  if (!r2Object) {
    return { error: 'CSV file not found' };
  }

  const csvContent = await r2Object.text();
  const { headers, rows } = parseCSV(csvContent);

  const dateIdx = headers.indexOf(dateColumn);
  const amountIdx = headers.indexOf(amountColumn);
  const descIdx = headers.indexOf(descriptionColumn);

  if (dateIdx === -1 || amountIdx === -1 || descIdx === -1) {
    return { error: 'Invalid column mapping' };
  }

  // Get existing hashes for duplicate detection
  const rowHashes = rows.map((row) => hashString(row.join('|')));
  const existingHashes = await transactionQueries.checkSourceHashes(db, projectId, rowHashes);

  // Create batch rows
  const batchRows = rows.map((row, index) => {
    const rawData = JSON.stringify(row);
    const sourceHash = rowHashes[index];

    // Parse amount - remove currency symbols, handle negative
    let amountStr = row[amountIdx] || '0';
    amountStr = amountStr.replace(/[$,]/g, '').trim();
    const parsedAmount = Math.round(parseFloat(amountStr) * 100) || 0;

    // Parse date
    const parsedDate = row[dateIdx] || '';

    // Description
    const parsedDescription = row[descIdx] || '';

    return {
      batchId,
      rowIndex: index,
      rawData,
      sourceHash,
      parsedAmount,
      parsedDate,
      parsedDescription,
      isDuplicate: existingHashes.has(sourceHash),
      excluded: false,
    };
  });

  await importBatchRowQueries.createMany(db, batchRows);

  // Update batch status and row count
  const { importBatches } = await import('~/lib/db/schema');
  const { eq } = await import('drizzle-orm');
  await db
    .update(importBatches)
    .set({ status: 'reviewing', rowCount: rows.length })
    .where(eq(importBatches.id, batchId));

  return redirect(`/projects/${projectId}/import/${batchId}/review`);
}

export default function MapColumns({ loaderData, actionData }: Route.ComponentProps) {
  const { user, project, batch, headers, previewRows, totalRows } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';

  const [dateColumn, setDateColumn] = useState<string>('');
  const [amountColumn, setAmountColumn] = useState<string>('');
  const [descriptionColumn, setDescriptionColumn] = useState<string>('');

  // Auto-detect columns based on common names
  useEffect(() => {
    const lowerHeaders = headers.map((h) => h.toLowerCase());

    // Date detection
    const datePatterns = ['date', 'posted', 'transaction date', 'trans date'];
    const dateIdx = lowerHeaders.findIndex((h) => datePatterns.some((p) => h.includes(p)));
    if (dateIdx !== -1) setDateColumn(headers[dateIdx]);

    // Amount detection
    const amountPatterns = ['amount', 'debit', 'credit', 'sum', 'total'];
    const amountIdx = lowerHeaders.findIndex((h) => amountPatterns.some((p) => h.includes(p)));
    if (amountIdx !== -1) setAmountColumn(headers[amountIdx]);

    // Description detection
    const descPatterns = ['description', 'memo', 'payee', 'merchant', 'name'];
    const descIdx = lowerHeaders.findIndex((h) => descPatterns.some((p) => h.includes(p)));
    if (descIdx !== -1) setDescriptionColumn(headers[descIdx]);
  }, [headers]);

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto">
        <Link to={`/projects/${project.id}/import`} className="inline-flex items-center gap-2 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          <Text size="sm">Back</Text>
        </Link>

        <div className="mb-6">
          <Text variant="heading1" as="h1">
            Map Columns
          </Text>
          <div className="mt-1">
            <Text variant="secondary">
              {batch.filename} - {totalRows} rows
            </Text>
          </div>
        </div>

        {actionData?.error && (
          <div className="mb-4">
            <Text variant="error">{actionData.error}</Text>
          </div>
        )}

        <Form method="post" className="space-y-6">
          <input type="hidden" name="dateColumn" value={dateColumn} />
          <input type="hidden" name="amountColumn" value={amountColumn} />
          <input type="hidden" name="descriptionColumn" value={descriptionColumn} />

          <div className="flex gap-4">
            <div className="flex-1">
              <Select
                label="Date Column"
                value={dateColumn}
                onValueChange={(v) => {
                  if (v) setDateColumn(v);
                }}
                disabled={isSubmitting}
                hideLabel={false}
                placeholder="Select column"
              >
                {headers.map((header) => (
                  <Select.Option key={header} value={header}>
                    {header}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="flex-1">
              <Select
                label="Amount Column"
                value={amountColumn}
                onValueChange={(v) => {
                  if (v) setAmountColumn(v);
                }}
                disabled={isSubmitting}
                hideLabel={false}
                placeholder="Select column"
              >
                {headers.map((header) => (
                  <Select.Option key={header} value={header}>
                    {header}
                  </Select.Option>
                ))}
              </Select>
            </div>

            <div className="flex-1">
              <Select
                label="Description Column"
                value={descriptionColumn}
                onValueChange={(v) => {
                  if (v) setDescriptionColumn(v);
                }}
                disabled={isSubmitting}
                hideLabel={false}
                placeholder="Select column"
              >
                {headers.map((header) => (
                  <Select.Option key={header} value={header}>
                    {header}
                  </Select.Option>
                ))}
              </Select>
            </div>
          </div>

          {/* Preview table */}
          <div>
            <div className="mb-2">
              <Text variant="heading3" as="h3">
                Preview
              </Text>
            </div>
            <Table>
              <Table.Header>
                <Table.Row>
                  {headers.map((header) => (
                    <Table.Head key={header}>
                      <Text
                        size="sm"
                        bold={
                          header === dateColumn ||
                          header === amountColumn ||
                          header === descriptionColumn
                        }
                      >
                        {header}
                        {header === dateColumn && ' (Date)'}
                        {header === amountColumn && ' (Amount)'}
                        {header === descriptionColumn && ' (Description)'}
                      </Text>
                    </Table.Head>
                  ))}
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {previewRows.map((row, rowIdx) => (
                  <Table.Row key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <Table.Cell key={cellIdx}>
                        <Text size="sm">{cell}</Text>
                      </Table.Cell>
                    ))}
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          </div>

          <div className="pt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting || !dateColumn || !amountColumn || !descriptionColumn}
            >
              Continue to Review
              <ArrowRightIcon className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </Form>
      </div>
    </AppShell>
  );
}
