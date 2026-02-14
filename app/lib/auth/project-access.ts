import type { Database } from '~/lib/db';
import type { ProjectRole, User, Project } from '~/lib/db/schema';

/**
 * Role hierarchy for permission checking
 * Higher index = more permissions
 */
const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  viewer: 0,
  editor: 1,
  owner: 2,
};

/**
 * Result returned when project access is verified
 */
export interface ProjectAccessResult {
  role: ProjectRole;
}

/**
 * Check if a user role meets or exceeds the minimum required role
 *
 * @param userRole - The user's current role
 * @param minimumRole - The minimum role required
 * @returns true if userRole >= minimumRole in hierarchy
 *
 * @example
 * hasMinimumRole('editor', 'viewer') // true
 * hasMinimumRole('viewer', 'editor') // false
 * hasMinimumRole('owner', 'owner')   // true
 */
export function hasMinimumRole(userRole: ProjectRole, minimumRole: ProjectRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[minimumRole];
}

/**
 * Check if a role can manage project members (add/remove/update)
 * Only owners can manage members
 *
 * @param role - The user's role
 * @returns true if role can manage members
 *
 * @example
 * canManageMembers('owner')  // true
 * canManageMembers('editor') // false
 * canManageMembers('viewer') // false
 */
export function canManageMembers(role: ProjectRole): boolean {
  return role === 'owner';
}

/**
 * Check if a role can edit project content
 * Owners and editors can edit
 *
 * @param role - The user's role
 * @returns true if role can edit
 *
 * @example
 * canEdit('owner')  // true
 * canEdit('editor') // true
 * canEdit('viewer') // false
 */
export function canEdit(role: ProjectRole): boolean {
  return hasMinimumRole(role, 'editor');
}

/**
 * Get a user's role in a project without throwing
 * Useful for conditional UI rendering
 *
 * @param db - Database instance
 * @param userId - User ID to check
 * @param projectId - Project ID to check access for
 * @returns The user's role or null if not a member
 *
 * @example
 * // In a loader for conditional UI:
 * const role = await getProjectRole(db, user.id, projectId);
 * return { canEdit: role ? canEdit(role) : false };
 */
export async function getProjectRole(
  db: Database,
  userId: User['id'],
  projectId: Project['id']
): Promise<ProjectRole | null> {
  // Import dynamically to avoid circular dependency issues
  // The query layer will provide this function
  const { projectMemberQueries } = await import('~/lib/db/queries/projectMembers');

  const role = await projectMemberQueries.getMemberRole(db, projectId, userId);
  return role;
}

/**
 * Require a minimum role for project access
 * Throws appropriate HTTP responses on failure
 *
 * Security: Returns 404 for both "project doesn't exist" and "user has no access"
 * to avoid leaking project existence information
 *
 * @param db - Database instance
 * @param userId - User ID to check
 * @param projectId - Project ID to check access for
 * @param minimumRole - Minimum role required for access
 * @returns Object containing the user's actual role
 * @throws Response with 404 if project doesn't exist or user has no access
 * @throws Response with 403 if user has access but insufficient role
 *
 * @example
 * // Require editor access in a loader:
 * export async function loader({ request, context, params }: Route.LoaderArgs) {
 *   const { user } = await requireAuth(request, context.cloudflare.env);
 *   const db = createDb(context.cloudflare.env.DB);
 *   const { role } = await requireProjectAccess(db, user.id, Number(params.projectId), 'editor');
 *   // User has at least editor access, proceed...
 * }
 *
 * @example
 * // Require owner access for member management:
 * const { role } = await requireProjectAccess(db, user.id, projectId, 'owner');
 */
export async function requireProjectAccess(
  db: Database,
  userId: User['id'],
  projectId: Project['id'],
  minimumRole: ProjectRole
): Promise<ProjectAccessResult> {
  const role = await getProjectRole(db, userId, projectId);

  // No access or project doesn't exist - return 404 to avoid leaking existence
  if (role === null) {
    throw new Response('Project not found', { status: 404 });
  }

  // Has access but insufficient role - return 403
  if (!hasMinimumRole(role, minimumRole)) {
    throw new Response('Insufficient permissions', { status: 403 });
  }

  return { role };
}
