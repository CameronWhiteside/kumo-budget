import { Link } from 'react-router';
import { Button, Text, Table } from '@cloudflare/kumo';
import { PlusIcon, ArrowLeftIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.accounts';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, accountQueries } from '~/lib/db/queries';
import type { AccountType } from '~/lib/db/schema';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `Accounts - ${projectName} - Kumo Budget` },
    { name: 'description', content: `Manage accounts for ${projectName}` },
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

  const accounts = await accountQueries.findByProject(db, projectId);

  return {
    user: { id: user.id, username: user.username },
    project,
    accounts,
  };
}

function formatCents(cents: number): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(dollars);
}

function formatAccountType(type: AccountType): string {
  const labels: Record<AccountType, string> = {
    checking: 'Checking',
    savings: 'Savings',
    credit_card: 'Credit Card',
    cash: 'Cash',
    other: 'Other',
  };
  return labels[type] || type;
}

export default function ProjectAccounts({ loaderData }: Route.ComponentProps) {
  const { user, project, accounts } = loaderData;

  return (
    <AppShell user={user}>
      <div className="max-w-4xl mx-auto">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-2 mb-6">
          <ArrowLeftIcon className="h-4 w-4" />
          <Text size="sm">Back to project</Text>
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <Text variant="heading1" as="h1">
              Accounts
            </Text>
            <div className="mt-1">
              <Text variant="secondary">{project.name}</Text>
            </div>
          </div>

          <Link to={`/projects/${project.id}/accounts/new`}>
            <Button variant="primary">
              <PlusIcon className="h-4 w-4 mr-2" />
              New Account
            </Button>
          </Link>
        </div>

        {accounts.length === 0 ? (
          <div className="py-12 text-center">
            <Text variant="secondary">No accounts yet. Create one to start tracking.</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Name</Table.Head>
                <Table.Head>Type</Table.Head>
                <Table.Head>Balance</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {accounts.map((account) => (
                <Table.Row key={account.id}>
                  <Table.Cell>
                    <Link to={`/projects/${project.id}/accounts/${account.id}`}>
                      <Text bold>{account.name}</Text>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Text variant="secondary">{formatAccountType(account.type)}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text>{formatCents(account.balance)}</Text>
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
