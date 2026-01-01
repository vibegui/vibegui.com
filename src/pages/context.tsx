/**
 * Context Page
 *
 * Browse LLM-generated summaries from works that inspire the author's writing.
 * These are used as context for AI-assisted content creation.
 */

import { Link } from "../app";
import { marked } from "marked";

interface ContextCollection {
  name: string;
  description: string;
  source: string;
  sourceUrl: string;
  authors: string;
  documents: { path: string; title: string }[];
}

// Hardcoded for now - could be generated from a manifest
const COLLECTIONS: ContextCollection[] = [
  {
    name: "Leadership",
    description:
      "Summaries from the ontological model of leadership developed by Werner Erhard and colleagues.",
    source:
      "Being a Leader and the Effective Exercise of Leadership: An Ontological/Phenomenological Model",
    sourceUrl: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1263835",
    authors: "Werner Erhard, Michael C. Jensen, Steve Zaffron, Kari Granger",
    documents: [
      { path: "leadership/01_integrity", title: "1. Integrity" },
      { path: "leadership/02_authenticity", title: "2. Authenticity" },
      {
        path: "leadership/03_something_bigger",
        title: "3. Committed to Something Bigger",
      },
      {
        path: "leadership/04_being_cause_in_matter",
        title: "4. Being Cause in the Matter",
      },
      {
        path: "leadership/05_future_as_context",
        title: "5. Future as Context",
      },
      {
        path: "leadership/06_already_always_listening",
        title: "6. Already-Always Listening",
      },
      { path: "leadership/07_life_sentences", title: "7. Life Sentences" },
      { path: "leadership/08_rackets", title: "8. Rackets" },
      {
        path: "leadership/09_authentic_listening",
        title: "9. Authentic Listening",
      },
      {
        path: "leadership/10_contextual_framework",
        title: "10. Contextual Framework",
      },
      { path: "leadership/11_power", title: "11. Power" },
    ],
  },
  {
    name: "Integrity",
    description:
      "A positive model of integrity as wholeness, separate from morality.",
    source:
      "Integrity: A Positive Model that Incorporates the Normative Phenomena of Morality, Ethics, and Legality",
    sourceUrl: "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=1542759",
    authors: "Werner Erhard, Michael C. Jensen, Steve Zaffron",
    documents: [
      {
        path: "integrity_positive_model_summary",
        title: "Integrity: A Positive Model - 10-Part Summary",
      },
    ],
  },
];

export function Context() {
  return (
    <div className="container py-6">
      <div className="prose">
        {/* Intro section */}
        <div className="mb-6">
          <div
            className="inline-block px-4 py-3 rounded-2xl text-sm"
            style={{
              backgroundColor: "var(--color-bg-secondary)",
              color: "var(--color-fg)",
            }}
          >
            <div>
              <strong>LLM-generated summaries</strong> from works that inspire
              my thinking, used as context for AI-assisted writing.
            </div>
            <div style={{ color: "var(--color-fg-muted)" }} className="mt-2">
              These are not reproductions of original works — they are
              interpretive summaries intended to help me internalize concepts
              and apply them in my own writing.
            </div>
            <div style={{ color: "var(--color-fg-muted)" }} className="mt-2">
              If you find these ideas valuable, I strongly encourage you to read
              the original papers linked below.
            </div>
          </div>
        </div>

        {/* Collections */}
        {COLLECTIONS.map((collection) => (
          <section key={collection.name} className="mb-6">
            <h2 className="text-base font-bold mb-1">{collection.name}</h2>
            <div
              className="text-xs mb-3 p-3 rounded"
              style={{ backgroundColor: "var(--color-bg-secondary)" }}
            >
              <p style={{ color: "var(--color-fg-muted)" }}>
                <a
                  href={collection.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {collection.source}
                </a>
                {" · "}
                {collection.authors}
              </p>
            </div>

            <ul className="space-y-1 text-sm">
              {collection.documents.map((doc) => (
                <li key={doc.path}>
                  <a href={`/context/${doc.path}`} className="hover:underline">
                    {doc.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

interface ContextData {
  path: string;
  title: string;
  content: string;
}

// Read embedded context data from SSG HTML
function getEmbeddedContext(): ContextData | null {
  if (typeof document === "undefined") return null;
  const script = document.getElementById("context-data");
  if (!script) return null;
  try {
    return JSON.parse(script.textContent || "");
  } catch {
    return null;
  }
}

/**
 * Context Document Page
 *
 * Renders a single context document with content embedded in the HTML.
 */
export function ContextDoc({ path }: { path: string }) {
  const data = getEmbeddedContext();

  // No embedded data or path mismatch
  if (!data || data.path !== path) {
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-bold mb-4">Document not found</h1>
        <p style={{ color: "var(--color-fg-muted)" }} className="mb-4">
          Could not load context data. Try{" "}
          <a href={`/context/${path}`} className="underline">
            refreshing the page
          </a>
          .
        </p>
        <Link href="/context">← Back to context</Link>
      </div>
    );
  }

  // Render markdown
  const html = marked(data.content, { async: false }) as string;

  // Determine which collection this belongs to for source attribution
  const collection = COLLECTIONS.find((c) =>
    c.documents.some((d) => d.path === path),
  );

  return (
    <article className="container py-4">
      <div className="prose">
        <Link
          href="/context"
          className="text-sm no-underline"
          style={{ color: "var(--color-fg-muted)" }}
        >
          ← Back to context
        </Link>

        {/* Source Attribution */}
        {collection && (
          <div
            className="mt-4 p-3 rounded text-xs"
            style={{ backgroundColor: "var(--color-bg-secondary)" }}
          >
            <p style={{ color: "var(--color-fg-muted)" }}>
              <strong>Source:</strong>{" "}
              <a
                href={collection.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {collection.source}
              </a>
              <br />
              <strong>Authors:</strong> {collection.authors}
              <br />
              <em>LLM-generated summary for educational purposes.</em>
            </p>
          </div>
        )}

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown content */}
        <div className="mt-4" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </article>
  );
}
