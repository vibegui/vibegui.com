/**
 * Article CRUD Helpers for AI Agents
 *
 * Provides createArticle, updateArticle, getArticleBySlug functions
 * for programmatic article management via Supabase.
 *
 * All write operations require explicit audit trail (createdBy/updatedBy).
 * Tag management uses delete + re-insert pattern on article_tags junction table.
 *
 * Callers are responsible for ensuring environment variables are loaded.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// -- Types --

export interface CreateArticleInput {
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  status?: "draft" | "published";
  coverImage?: string | null;
  tags?: string[];
  createdBy: string;
}

export interface UpdateArticleInput {
  title?: string;
  description?: string;
  content?: string;
  date?: string;
  status?: "draft" | "published";
  coverImage?: string | null;
  tags?: string[];
  updatedBy: string;
}

export interface ArticleWithTags {
  id: number;
  slug: string;
  title: string;
  description: string;
  content: string;
  date: string;
  status: string;
  cover_image: string | null;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  tags: string[];
}

// -- Internal Helpers --

/**
 * Create a Supabase client using service role credentials.
 * Reads SUPABASE_URL (fallback VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY from process.env.
 */
function getServiceClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "Missing SUPABASE_URL (or VITE_SUPABASE_URL) environment variable",
    );
  }

  if (!supabaseServiceKey) {
    throw new Error("Missing SUPABASE_SERVICE_KEY environment variable");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Manage tags for an article using delete + re-insert pattern.
 * Copied from scripts/import-articles.ts proven pattern.
 */
async function upsertTags(
  supabase: SupabaseClient,
  articleId: number,
  tags: string[],
): Promise<void> {
  // Step 1: Delete all existing tags for this article
  const { error: deleteError } = await supabase
    .from("article_tags")
    .delete()
    .eq("article_id", articleId);

  if (deleteError) {
    throw new Error(
      `Failed to delete existing tags for article ${articleId}: ${deleteError.message}`,
    );
  }

  // Step 2: If no tags, we're done
  if (tags.length === 0) {
    return;
  }

  // Step 3: Upsert tag names into tags table
  const tagRows = tags.map((name) => ({ name }));
  const { error: tagUpsertError } = await supabase
    .from("tags")
    .upsert(tagRows, { onConflict: "name" });

  if (tagUpsertError) {
    throw new Error(`Failed to upsert tags: ${tagUpsertError.message}`);
  }

  // Step 4: Fetch tag IDs by name
  const { data: tagData, error: tagFetchError } = await supabase
    .from("tags")
    .select("id, name")
    .in("name", tags);

  if (tagFetchError) {
    throw new Error(`Failed to fetch tag IDs: ${tagFetchError.message}`);
  }

  // Step 5: Insert junction rows into article_tags
  const junctionRows = (tagData || []).map((tag) => ({
    article_id: articleId,
    tag_id: tag.id,
  }));

  if (junctionRows.length > 0) {
    const { error: junctionError } = await supabase
      .from("article_tags")
      .insert(junctionRows);

    if (junctionError) {
      throw new Error(
        `Failed to insert article_tags: ${junctionError.message}`,
      );
    }
  }
}

// -- Exported Functions --

/**
 * Create an article in Supabase with full audit trail.
 *
 * @param input - Article data with required createdBy field
 * @returns The created article's id and slug
 */
export async function createArticle(
  input: CreateArticleInput,
): Promise<{ id: number; slug: string }> {
  const supabase = getServiceClient();

  const row = {
    slug: input.slug,
    title: input.title,
    description: input.description,
    content: input.content,
    date: input.date,
    status: input.status ?? "draft",
    cover_image: input.coverImage ?? null,
    created_by: input.createdBy,
    updated_by: input.createdBy,
  };

  const { data, error } = await supabase
    .from("articles")
    .insert(row)
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(
      `Failed to create article "${input.slug}": ${error.message}`,
    );
  }

  // Manage tags if provided
  if (input.tags && input.tags.length > 0) {
    await upsertTags(supabase, data.id, input.tags);
  }

  return { id: data.id, slug: data.slug };
}

/**
 * Update an article by slug with audit trail.
 * Only updates fields that are explicitly provided.
 *
 * @param slug - The article slug to update
 * @param input - Fields to update, with required updatedBy field
 * @returns The updated article's id and slug
 */
export async function updateArticle(
  slug: string,
  input: UpdateArticleInput,
): Promise<{ id: number; slug: string }> {
  const supabase = getServiceClient();

  // Build update object with only provided fields
  const update: Record<string, unknown> = {
    updated_by: input.updatedBy,
  };

  if (input.title !== undefined) update.title = input.title;
  if (input.description !== undefined) update.description = input.description;
  if (input.content !== undefined) update.content = input.content;
  if (input.date !== undefined) update.date = input.date;
  if (input.status !== undefined) update.status = input.status;
  if (input.coverImage !== undefined) update.cover_image = input.coverImage;

  const { data, error } = await supabase
    .from("articles")
    .update(update)
    .eq("slug", slug)
    .select("id, slug")
    .single();

  if (error) {
    throw new Error(`Failed to update article "${slug}": ${error.message}`);
  }

  // Manage tags if provided (even empty array replaces all tags)
  if (input.tags !== undefined) {
    await upsertTags(supabase, data.id, input.tags);
  }

  return { id: data.id, slug: data.slug };
}

/**
 * Retrieve an article by slug with its tags.
 *
 * @param slug - The article slug to look up
 * @returns The article with nested tag names
 */
export async function getArticleBySlug(slug: string): Promise<ArticleWithTags> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from("articles")
    .select("*, article_tags(tags(name))")
    .eq("slug", slug)
    .single();

  if (error) {
    throw new Error(`Failed to get article "${slug}": ${error.message}`);
  }

  // Extract tag names from nested structure
  const tags =
    (data.article_tags as Array<{ tags: { name: string } | null }> | null)
      ?.map((at) => at.tags?.name)
      .filter((name): name is string => name != null) ?? [];

  return {
    id: data.id,
    slug: data.slug,
    title: data.title,
    description: data.description,
    content: data.content,
    date: data.date,
    status: data.status,
    cover_image: data.cover_image,
    created_by: data.created_by,
    updated_by: data.updated_by,
    created_at: data.created_at,
    updated_at: data.updated_at,
    tags,
  };
}
