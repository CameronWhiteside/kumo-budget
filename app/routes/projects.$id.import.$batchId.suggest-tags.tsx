import type { Route } from './+types/projects.$id.import.$batchId.suggest-tags';
import { requireAuth } from '~/lib/auth';
import { requireProjectAccess } from '~/lib/auth/project-access';
import { createDb } from '~/lib/db';
import { importBatchQueries, importBatchRowQueries, tagQueries } from '~/lib/db/queries';

interface RowInput {
  id: number;
  description: string;
  amount: number;
}

interface RequestBody {
  rows: RowInput[];
}

interface AiSuggestion {
  index: number;
  tags: string[];
}

/**
 * AI-powered tag suggestion endpoint
 * POST /projects/:id/import/:batchId/suggest-tags
 */
export async function action({ request, context, params }: Route.ActionArgs) {
  const { user } = await requireAuth(request, context.cloudflare.env);
  const db = createDb(context.cloudflare.env.DB);
  const ai = context.cloudflare.env.AI;

  const projectId = Number(params.id);
  const batchId = Number(params.batchId);
  if (isNaN(projectId) || isNaN(batchId)) {
    return Response.json({ error: 'Invalid ID' }, { status: 400 });
  }

  await requireProjectAccess(db, user.id, projectId, 'editor');

  // Verify batch exists
  const batch = await importBatchQueries.findByIdAndProject(db, batchId, projectId);
  if (!batch) {
    return Response.json({ error: 'Batch not found' }, { status: 404 });
  }

  // Get project tags
  const tags = await tagQueries.findByProject(db, projectId);
  if (tags.length === 0) {
    return Response.json({ suggestions: [] });
  }

  // Parse request body
  const body: RequestBody = await request.json();
  const rows = body.rows;

  if (rows.length === 0) {
    return Response.json({ suggestions: [] });
  }

  // Build prompt
  const tagNames = tags.map((t) => t.name);
  const tagNameToId = new Map(tags.map((t) => [t.name.toLowerCase(), t.id]));

  // Process in batches of 20
  const batchSize = 20;
  const allSuggestions: { rowId: number; tagIds: number[] }[] = [];

  for (let i = 0; i < rows.length; i += batchSize) {
    const rowBatch = rows.slice(i, i + batchSize);

    const transactionLines = rowBatch
      .map((r, idx) => {
        const sign = r.amount >= 0 ? '+' : '';
        const dollars = (r.amount / 100).toFixed(2);
        return `${String(idx + 1)}. "${r.description}" (${sign}${dollars})`;
      })
      .join('\n');

    const prompt = `You are a financial transaction categorization assistant. Given a list of available tags and transaction descriptions, suggest which tags apply to each transaction.

Available tags: ${tagNames.join(', ')}

Transactions:
${transactionLines}

For each transaction, respond with ONLY the tag names that apply (0-3 tags per transaction). Use ONLY tags from the available list above.

Respond in this exact JSON format:
[
  {"index": 1, "tags": ["tag1", "tag2"]},
  {"index": 2, "tags": []},
  ...
]

Only include tags that clearly match the transaction. If unsure, use an empty array.`;

    try {
      const response = await ai.run(
        '@cf/meta/llama-3-8b-instruct' as Parameters<typeof ai.run>[0],
        {
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1024,
        }
      );

      // Parse AI response
      const responseText =
        typeof response === 'string'
          ? response
          : ((response as { response?: string }).response ?? '');

      // Extract JSON from response (handle markdown code blocks)
      let jsonStr = responseText;
      const jsonMatch = /\[[\s\S]*\]/.exec(responseText);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      try {
        const parsed = JSON.parse(jsonStr) as AiSuggestion[];

        for (const item of parsed) {
          const rowIndex = item.index - 1; // Convert to 0-indexed
          if (rowIndex >= 0 && rowIndex < rowBatch.length) {
            const row = rowBatch[rowIndex];
            const tagIds = item.tags
              .map((tagName) => tagNameToId.get(tagName.toLowerCase()))
              .filter((id): id is number => id !== undefined);

            if (tagIds.length > 0) {
              allSuggestions.push({ rowId: row.id, tagIds });
            }
          }
        }
      } catch {
        console.error('Failed to parse AI response:', responseText);
      }
    } catch (error) {
      console.error('AI request failed:', error);
    }
  }

  // Apply suggestions to batch rows
  if (allSuggestions.length > 0) {
    await importBatchRowQueries.bulkUpdateTags(
      db,
      allSuggestions.map((s) => ({ id: s.rowId, tagIds: s.tagIds }))
    );
  }

  return Response.json({ suggestions: allSuggestions });
}
