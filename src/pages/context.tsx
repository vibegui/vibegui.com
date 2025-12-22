/**
 * Context Page
 *
 * Browse LLM-generated summaries from works that inspire the author's writing.
 * These are used as context for AI-assisted content creation.
 */

import { useState, useEffect } from "react";
import { Link } from "../app";
import { marked } from "marked";
import { getContextPath } from "../lib/manifest";

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
      { path: "leadership/07_rackets", title: "7. Rackets" },
      {
        path: "leadership/08_authentic_listening",
        title: "8. Authentic Listening",
      },
      {
        path: "leadership/09_contextual_framework",
        title: "9. Contextual Framework",
      },
      { path: "leadership/10_power", title: "10. Power" },
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
                  <Link
                    href={`/context/${doc.path}`}
                    className="hover:underline"
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

/**
 * Context Document Page
 *
 * Renders a single context document from the context/ folder.
 */
export function ContextDoc({ path }: { path: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [title, setTitle] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDoc = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get hashed path from manifest, fallback to direct path in dev
        const contextPath = await getContextPath(path);
        if (!contextPath) {
          throw new Error("Document not found");
        }

        const response = await fetch(contextPath);
        if (!response.ok) {
          throw new Error("Document not found");
        }

        const raw = await response.text();

        // Extract title from first H1
        const titleMatch = raw.match(/^#\s+(.+)/m);
        if (titleMatch?.[1]) {
          setTitle(titleMatch[1]);
        } else {
          setTitle(path.split("/").pop() ?? path);
        }

        // Render markdown
        const html = marked(raw, { async: false }) as string;
        setContent(html);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }

      setLoading(false);
    };

    loadDoc();
  }, [path]);

  // Update document title
  useEffect(() => {
    if (title) {
      document.title = `${title} | vibegui.com`;
    }
    return () => {
      document.title = "vibegui.com";
    };
  }, [title]);

  if (loading) {
    return (
      <div className="container py-12">
        <p style={{ color: "var(--color-fg-muted)" }}>Loading...</p>
      </div>
    );
  }

  if (error || !content) {
    return (
      <div className="container py-12">
        <h1 className="text-2xl font-bold mb-4">Document not found</h1>
        <p style={{ color: "var(--color-fg-muted)" }} className="mb-4">
          {error}
        </p>
        <Link href="/context">← Back to context</Link>
      </div>
    );
  }

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
        <div className="mt-4" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </article>
  );
}
