import { eq, sql } from 'drizzle-orm';
import type { Database } from '../index';
import {
  projects,
  projectMembers,
  type Project,
  type ProjectWithMembers,
  type ProjectRole,
} from '../schema';

/**
 * Project query functions
 * All database operations related to projects are encapsulated here.
 * Routes should never call db methods directly.
 */
export const projectQueries = {
  /**
   * Create a new project and add the owner as a member with 'owner' role
   * @param db - Database instance
   * @param data - Project data including name, optional parentId, and ownerId
   * @returns Created project
   */
  create: async (
    db: Database,
    data: { name: string; parentId?: number | null; ownerId: number }
  ): Promise<Project> => {
    const { name, parentId, ownerId } = data;

    // Insert project
    const [project] = await db
      .insert(projects)
      .values({ name, parentId: parentId ?? null })
      .returning();

    // Add owner as member with 'owner' role
    await db.insert(projectMembers).values({
      userId: ownerId,
      projectId: project.id,
      role: 'owner' as ProjectRole,
    });

    return project;
  },

  /**
   * Find a project by its ID
   * @param db - Database instance
   * @param id - Project ID to search for
   * @returns Project or undefined if not found
   */
  findById: async (db: Database, id: number): Promise<Project | undefined> => {
    return db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
  },

  /**
   * Find a project by ID with all members and their user data
   * @param db - Database instance
   * @param id - Project ID to search for
   * @returns Project with members or undefined if not found
   */
  findByIdWithMembers: async (
    db: Database,
    id: number
  ): Promise<ProjectWithMembers | undefined> => {
    const result = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        members: {
          with: {
            user: true,
          },
        },
      },
    });
    return result as ProjectWithMembers | undefined;
  },

  /**
   * Find all projects a user has access to (via projectMembers)
   * @param db - Database instance
   * @param userId - User ID to find projects for
   * @returns Array of projects the user is a member of
   */
  findUserProjects: async (db: Database, userId: number): Promise<Project[]> => {
    const memberships = await db.query.projectMembers.findMany({
      where: eq(projectMembers.userId, userId),
      with: {
        project: true,
      },
    });
    return memberships.map((m) => m.project);
  },

  /**
   * Find direct child projects of a parent project
   * @param db - Database instance
   * @param parentId - Parent project ID
   * @returns Array of child projects
   */
  findChildren: async (db: Database, parentId: number): Promise<Project[]> => {
    return db.query.projects.findMany({
      where: eq(projects.parentId, parentId),
    });
  },

  /**
   * Find all ancestor projects (for breadcrumbs navigation)
   * Uses recursive approach to traverse up the hierarchy
   * @param db - Database instance
   * @param projectId - Project ID to find ancestors for
   * @returns Array of ancestor projects, ordered from root to immediate parent
   */
  findAncestors: async (db: Database, projectId: number): Promise<Project[]> => {
    const ancestors: Project[] = [];
    let currentId: number | null = projectId;

    // First, get the current project to find its parent
    const current = await db.query.projects.findFirst({
      where: eq(projects.id, currentId),
    });

    if (!current) {
      return ancestors;
    }

    currentId = current.parentId;

    // Traverse up the hierarchy
    while (currentId !== null) {
      const parent = await db.query.projects.findFirst({
        where: eq(projects.id, currentId),
      });

      if (!parent) {
        break;
      }

      ancestors.unshift(parent); // Add to beginning to maintain root-to-parent order
      currentId = parent.parentId;
    }

    return ancestors;
  },

  /**
   * Update a project's properties
   * @param db - Database instance
   * @param id - Project ID to update
   * @param data - Data to update (name)
   * @returns Updated project or undefined if not found
   */
  update: async (
    db: Database,
    id: number,
    data: { name?: string }
  ): Promise<Project | undefined> => {
    const [updated] = await db
      .update(projects)
      .set({
        ...data,
        updatedAt: sql`(datetime('now'))`,
      })
      .where(eq(projects.id, id))
      .returning();

    return updated;
  },

  /**
   * Delete a project by ID
   * Children are automatically deleted via FK cascade
   * @param db - Database instance
   * @param id - Project ID to delete
   */
  delete: async (db: Database, id: number): Promise<void> => {
    await db.delete(projects).where(eq(projects.id, id));
  },
};
