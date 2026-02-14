import { eq, sql } from 'drizzle-orm';
import type { Database } from '../index';
import {
  projects,
  projectMembers,
  type Project,
  type ProjectWithMembers,
  type ProjectRole,
  type User,
} from '../schema';

/**
 * Project query functions
 */
export const projectQueries = {
  /**
   * Create a new project and add the owner as a member with 'owner' role
   */
  create: async (
    db: Database,
    data: { name: string; parentId?: Project['id'] | null; ownerId: User['id'] }
  ): Promise<Project> => {
    const { name, parentId, ownerId } = data;

    const [project] = await db
      .insert(projects)
      .values({ id: crypto.randomUUID(), name, parentId: parentId ?? null })
      .returning();

    await db.insert(projectMembers).values({
      userId: ownerId,
      projectId: project.id,
      role: 'owner' as ProjectRole,
    });

    return project;
  },

  /**
   * Find a project by its ID
   */
  findById: async (db: Database, id: Project['id']): Promise<Project | undefined> => {
    return db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
  },

  /**
   * Find a project by ID with all members and their user data
   */
  findByIdWithMembers: async (
    db: Database,
    id: Project['id']
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
   */
  findUserProjects: async (db: Database, userId: User['id']): Promise<Project[]> => {
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
   */
  findChildren: async (db: Database, parentId: Project['id']): Promise<Project[]> => {
    return db.query.projects.findMany({
      where: eq(projects.parentId, parentId),
    });
  },

  /**
   * Find all ancestor projects (for breadcrumbs navigation)
   */
  findAncestors: async (db: Database, projectId: Project['id']): Promise<Project[]> => {
    const ancestors: Project[] = [];
    let currentId: Project['parentId'] = projectId;

    const current = await db.query.projects.findFirst({
      where: eq(projects.id, currentId),
    });

    if (!current) {
      return ancestors;
    }

    currentId = current.parentId;

    while (currentId !== null) {
      const parent = await db.query.projects.findFirst({
        where: eq(projects.id, currentId),
      });

      if (!parent) {
        break;
      }

      ancestors.unshift(parent);
      currentId = parent.parentId;
    }

    return ancestors;
  },

  /**
   * Update a project's properties
   */
  update: async (
    db: Database,
    id: Project['id'],
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
   */
  delete: async (db: Database, id: Project['id']): Promise<void> => {
    await db.delete(projects).where(eq(projects.id, id));
  },
};
