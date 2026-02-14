import { useState } from 'react';
import { Form, Link, redirect, useNavigation, useSubmit } from 'react-router';
import { Button, Input, Text, Table } from '@cloudflare/kumo';
import { ArrowLeftIcon, TrashIcon, UploadIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.accounts.$accountId';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, accountQueries, transactionQueries } from '~/lib/db/queries';
import type { AccountType } from '~/lib/db/schema';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const accountName = loaderData?.account?.name ?? 'Account';
  return [
    { title: `${accountName} - Kumo Budget` },
    { name: 'description', content: `View and manage ${accountName}` },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  const accountId = Number(params.accountId);
  if (isNaN(projectId) || isNaN(accountId)) {
    throw new Response('Invalid ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'viewer');

  const project = await projectQueries.findById(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  const account = await accountQueries.findByIdAndProject(db, accountId, projectId);
  if (!account) {
    throw new Response('Account not found', { status: 404 });
  }

  const transactions = await transactionQueries.findByAccount(db, accountId);

  return {
    user: { id: user.id, username: user.username },
    project,
    account,
    transactions,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = Number(params.id);
  const accountId = Number(params.accountId);
  if (isNaN(projectId) || isNaN(accountId)) {
    throw new Response('Invalid ID', { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  const formData = await request.formData();
  const intent = formData.get('intent');

  switch (intent) {
    case 'updateBalance': {
      const balanceStr = formData.get('balance');
      if (typeof balanceStr === 'string') {
        const parsed = parseFloat(balanceStr);
        if (!isNaN(parsed)) {
          const balance = Math.round(parsed * 100);
          await accountQueries.update(db, accountId, { balance });
        }
      }
      return { success: true };
    }

    case 'delete': {
      await accountQueries.delete(db, accountId);
      return redirect(`/projects/${projectId}/accounts`);
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function AccountDetail({ loaderData }: Route.ComponentProps) {
  const { user, project, account, transactions } = loaderData;
  const navigation = useNavigation();
  const submit = useSubmit();
  const isSubmitting = navigation.state === 'submitting';
  const [balance, setBalance] = useState((account.balance / 100).toFixed(2));

  const handleBalanceBlur = () => {
    const newBalance = parseFloat(balance);
    if (!isNaN(newBalance) && Math.round(newBalance * 100) !== account.balance) {
      const formData = new FormData();
      formData.set('intent', 'updateBalance');
      formData.set('balance', balance);
      void submit(formData, { method: 'post' });
    }
  };

  // Calculate computed balance from transactions
  const computedBalance = transactions.reduce((sum, txn) => sum + txn.amount, 0);

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto">
        <Link
          to={`/projects/${project.id}/accounts`}
          className="inline-flex items-center gap-2 mb-6"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          <Text size="sm">Back to accounts</Text>
        </Link>

        <div className="flex items-start justify-between mb-8">
          <div>
            <Text variant="heading1" as="h1">
              {account.name}
            </Text>
            <div className="mt-1">
              <Text variant="secondary">
                {ACCOUNT_TYPE_OPTIONS.find((o) => o.value === account.type)?.label ?? account.type}
              </Text>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link to={`/projects/${project.id}/import?account=${account.id}`}>
              <Button variant="secondary">
                <UploadIcon className="h-4 w-4 mr-2" />
                Import CSV
              </Button>
            </Link>

            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                onClick={(e) => {
                  if (
                    !confirm(`Delete "${account.name}"? This will also delete all transactions.`)
                  ) {
                    e.preventDefault();
                  }
                }}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </Form>
          </div>
        </div>

        {/* Balance section */}
        <div className="mb-8 flex items-end gap-8">
          <div>
            <Text variant="secondary" size="sm">
              Actual Balance
            </Text>
            <div className="mt-1">
              <Input
                value={balance}
                onChange={(e) => {
                  setBalance(e.target.value);
                }}
                onBlur={handleBalanceBlur}
                type="number"
                step="0.01"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <Text variant="secondary" size="sm">
              Computed from Transactions
            </Text>
            <div className="mt-1">
              <Text variant="heading2">{formatCents(computedBalance)}</Text>
            </div>
          </div>

          {account.balance !== computedBalance && (
            <div>
              <Text variant="secondary" size="sm">
                Difference
              </Text>
              <div className="mt-1">
                <Text>{formatCents(account.balance - computedBalance)}</Text>
              </div>
            </div>
          )}
        </div>

        {/* Transactions */}
        <div className="mb-4">
          <Text variant="heading2" as="h2">
            Transactions
          </Text>
        </div>

        {transactions.length === 0 ? (
          <div className="py-8 text-center">
            <Text variant="secondary">No transactions yet. Import a CSV to get started.</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Date</Table.Head>
                <Table.Head>Description</Table.Head>
                <Table.Head>Tags</Table.Head>
                <Table.Head>Amount</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {transactions.map((txn) => (
                <Table.Row key={txn.id}>
                  <Table.Cell>
                    <Text size="sm">{formatDate(txn.date)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{txn.description}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    {txn.tags.length > 0 ? (
                      <Text variant="secondary" size="sm">
                        {txn.tags.map((t) => t.name).join(', ')}
                      </Text>
                    ) : (
                      <Text variant="secondary" size="sm">
                        -
                      </Text>
                    )}
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{formatCents(txn.amount)}</Text>
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
