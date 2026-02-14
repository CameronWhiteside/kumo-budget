import { Link } from 'react-router';
import { Breadcrumbs, Button, Empty, Link as KumoLink, Table, Text } from '@cloudflare/kumo';
import { BankIcon, HouseIcon, PlusIcon } from '@phosphor-icons/react/dist/ssr';

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

  const projectId = params.id;
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
        <div className="mb-6">
          <Breadcrumbs>
            <Breadcrumbs.Link icon={<HouseIcon size={16} />} href="/">
              Home
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link href={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current icon={<BankIcon size={16} />}>Accounts</Breadcrumbs.Current>
          </Breadcrumbs>
        </div>

        <div className="flex items-center justify-between mb-6">
          <Text variant="heading1" as="h1">
            Accounts
          </Text>

          <Link to={`/projects/${project.id}/accounts/new`}>
            <Button variant="primary" icon={<PlusIcon />}>
              New Account
            </Button>
          </Link>
        </div>

        {accounts.length === 0 ? (
          <Empty
            icon={<BankIcon size={48} />}
            title="No accounts yet"
            description="Create an account to start tracking your finances."
            contents={
              <Link to={`/projects/${project.id}/accounts/new`}>
                <Button variant="primary" icon={<PlusIcon />}>
                  Create Account
                </Button>
              </Link>
            }
          />
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
                    <KumoLink
                      render={<Link to={`/projects/${project.id}/accounts/${account.id}`} />}
                    >
                      {account.name}
                    </KumoLink>
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
