import { type RouteConfig, index, route } from '@react-router/dev/routes';

export default [
  index('routes/home.tsx'),
  route('login', 'routes/login.tsx'),
  route('logout', 'routes/logout.tsx'),
  route('projects', 'routes/projects._index.tsx'),
  route('projects/new', 'routes/projects.new.tsx'),
  route('projects/:id', 'routes/projects.$id.tsx'),
  route('projects/:id/settings', 'routes/projects.$id.settings.tsx'),
  route('projects/:id/new', 'routes/projects.$id.new.tsx'),
] satisfies RouteConfig;
