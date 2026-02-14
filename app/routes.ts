import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  route('register', 'routes/register.tsx'),
  route('logout', 'routes/logout.tsx'),
  route('projects', 'routes/projects._index.tsx'),
  route('projects/new', 'routes/projects.new.tsx'),
  route('projects/:id', 'routes/projects.$id.tsx'),
  route('projects/:id/settings', 'routes/projects.$id.settings.tsx'),
  route('projects/:id/new', 'routes/projects.$id.new.tsx'),
  // Accounts
  route('projects/:id/accounts', 'routes/projects.$id.accounts.tsx'),
  route('projects/:id/accounts/new', 'routes/projects.$id.accounts.new.tsx'),
  route('projects/:id/accounts/:accountId', 'routes/projects.$id.accounts.$accountId.tsx'),
  // Tags
  route('projects/:id/tags', 'routes/projects.$id.tags.tsx'),
  // Import flow
  route('projects/:id/import', 'routes/projects.$id.import.tsx'),
  route('projects/:id/import/:batchId/map', 'routes/projects.$id.import.$batchId.map.tsx'),
  route('projects/:id/import/:batchId/review', 'routes/projects.$id.import.$batchId.review.tsx'),
  route(
    'projects/:id/import/:batchId/suggest-tags',
    'routes/projects.$id.import.$batchId.suggest-tags.tsx'
  ),
] satisfies RouteConfig;
