import { useState } from 'react';
import { Form, redirect, useNavigation } from 'react-router';
import { Banner, BannerVariant, Breadcrumbs, Button, Input, Select, Text } from '@cloudflare/kumo';
import { BankIcon, HouseIcon, PlusIcon } from '@phosphor-icons/react/dist/ssr';

import { AppShell } from '~/components/AppShell';
import type { Route } from './+types/projects.$id.accounts.new';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { projectQueries, accountQueries } from '~/lib/db/queries';
import { ACCOUNT_TYPES, type AccountType } from '~/lib/db/schema';

export function meta({ loaderData }: Route.MetaArgs): Route.MetaDescriptors {
  const projectName = loaderData?.project?.name ?? 'Project';
  return [
    { title: `New Account - ${projectName} - Kumo Budget` },
    { name: 'description', content: `Create a new account in ${projectName}` },
  ];
}

export async function loader({ request, context, params }: Route.LoaderArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = params.id;
  await requireProjectAccess(db, user.id, projectId, 'editor');

  const project = await projectQueries.findById(db, projectId);
  if (!project) {
    throw new Response('Project not found', { status: 404 });
  }

  return {
    user: { id: user.id, username: user.username },
    project,
  };
}

export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);

  const projectId = params.id;
  await requireProjectAccess(db, user.id, projectId, 'editor');

  const formData = await request.formData();
  const name = formData.get('name');
  const type = formData.get('type') as AccountType;
  const balanceStr = formData.get('balance');

  if (typeof name !== 'string' || !name.trim()) {
    return { error: 'Name is required' };
  }

  if (!ACCOUNT_TYPES.includes(type)) {
    return { error: 'Invalid account type' };
  }

  // Parse balance from dollars to cents
  let balance = 0;
  if (balanceStr && typeof balanceStr === 'string') {
    const parsed = parseFloat(balanceStr);
    if (!isNaN(parsed)) {
      balance = Math.round(parsed * 100);
    }
  }

  const account = await accountQueries.create(db, {
    id: crypto.randomUUID(),
    projectId,
    name: name.trim(),
    type,
    balance,
  });

  return redirect(`/projects/${projectId}/accounts/${account.id}`);
}

const ACCOUNT_TYPE_OPTIONS: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Checking' },
  { value: 'savings', label: 'Savings' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'cash', label: 'Cash' },
  { value: 'other', label: 'Other' },
];

export default function NewAccount({ loaderData, actionData }: Route.ComponentProps) {
  const { user, project } = loaderData;
  const navigation = useNavigation();
  const isSubmitting = navigation.state === 'submitting';
  const [accountType, setAccountType] = useState<string>('checking');

  return (
    <AppShell user={user}>
      <div className="max-w-md mx-auto">
        <div className="mb-6">
          <Breadcrumbs>
            <Breadcrumbs.Link icon={<HouseIcon size={16} />} href="/">
              Home
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link href={`/projects/${project.id}`}>{project.name}</Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Link
              icon={<BankIcon size={16} />}
              href={`/projects/${project.id}/accounts`}
            >
              Accounts
            </Breadcrumbs.Link>
            <Breadcrumbs.Separator />
            <Breadcrumbs.Current icon={<PlusIcon size={16} />}>New Account</Breadcrumbs.Current>
          </Breadcrumbs>
        </div>

        <div className="mb-6">
          <Text variant="heading1" as="h1">
            New Account
          </Text>
        </div>

        {actionData?.error && <Banner variant={BannerVariant.ERROR}>{actionData.error}</Banner>}

        <Form method="post" className="space-y-4">
          <input type="hidden" name="type" value={accountType} />

          <Input
            label="Name"
            name="name"
            type="text"
            placeholder="e.g., Chase Checking"
            required
            disabled={isSubmitting}
          />

          <Select
            label="Type"
            value={accountType}
            onValueChange={(v) => {
              if (v) setAccountType(v);
            }}
            disabled={isSubmitting}
            hideLabel={false}
            items={ACCOUNT_TYPE_OPTIONS}
          >
            {ACCOUNT_TYPE_OPTIONS.map((opt) => (
              <Select.Option key={opt.value} value={opt.value}>
                {opt.label}
              </Select.Option>
            ))}
          </Select>

          <Input
            label="Current Balance"
            name="balance"
            type="number"
            step="0.01"
            placeholder="0.00"
            disabled={isSubmitting}
          />

          <div className="pt-4">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              Create Account
            </Button>
          </div>
        </Form>
      </div>
    </AppShell>
  );
}
