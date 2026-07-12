import type { Env } from "./env.ts";

export interface WritingCitation {
  slug: string;
  source: string;
  text: string;
  score?: number;
}

const MATCH_THRESHOLD = 0.35;

export async function searchWritingCorpus(
  env: Env,
  query: string,
  topK = 10,
): Promise<WritingCitation[]> {
  if (!env.AUTORAG_INSTANCE?.trim() || !env.AUTORAG) return [];

  try {
    const result = await env.AUTORAG.search({
      query,
      ai_search_options: {
        retrieval: {
          max_num_results: Math.min(20, Math.max(1, topK)),
          match_threshold: MATCH_THRESHOLD,
          context_expansion: 1,
          return_on_failure: false,
        },
        query_rewrite: { enabled: false },
        reranking: { enabled: false },
      },
    });

    return (result.chunks ?? []).map((chunk) => {
      const key = chunk.item?.key ?? "unknown";
      return {
        slug: key.replace(/^articles\//, "").replace(/\.md$/i, ""),
        source: key,
        text: chunk.text,
        score: chunk.score,
      };
    });
  } catch (error) {
    console.warn("AI Search unavailable; using lexical fallback", error);
    return [];
  }
}

export async function getCorpusStatus(env: Env) {
  const [objects, search] = await Promise.all([
    env.CORPUS.list({ prefix: "articles/", limit: 1000 }),
    env.AUTORAG.stats().catch(() => null),
  ]);

  return {
    bucket: "vibegui-corpus",
    prefix: "articles/",
    markdown_objects: objects.objects.length,
    truncated: objects.truncated,
    autorag_instance: env.AUTORAG_INSTANCE,
    indexed_objects: search?.engine?.r2?.objectCount ?? null,
    vectors: search?.engine?.vectorize?.vectorsCount ?? null,
    dimensions: search?.engine?.vectorize?.dimensions ?? null,
  };
}
