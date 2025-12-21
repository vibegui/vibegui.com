/**
 * Context Page
 *
 * Browse LLM-generated summaries from works that inspire the author's writing.
 * These are used as context for AI-assisted content creation.
 */

import { useState, useEffect } from "react";
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
    <div className="container py-8 md:py-12">
      <div className="prose">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold">Context</h1>
          <p className="mt-4" style={{ color: "var(--color-fg-muted)" }}>
            Reference materials that inform my thinking and writing.
          </p>
        </header>

        {/* Notice Card */}
        <div
          className="p-6 rounded-lg mb-12"
          style={{
            backgroundColor: "var(--color-bg-secondary)",
            borderLeft: "4px solid var(--color-accent)",
          }}
        >
          <h2 className="text-lg font-semibold mb-3">About These Documents</h2>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-fg-muted)" }}
          >
            These are <strong>LLM-generated summaries</strong> from works that
            inspire my thinking. They serve as context for AI-assisted writing
            and are created for educational and personal creative purposes only.
          </p>
          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-fg-muted)" }}
          >
            <strong>These are not reproductions of original works.</strong> They
            are interpretive summaries intended to help me internalize concepts
            and apply them in my own writing. If you find these ideas valuable,
            I strongly encourage you to read the original papers linked below.
          </p>
          <p className="text-xs" style={{ color: "var(--color-fg-muted)" }}>
            The original materials are the intellectual property of their
            respective authors. These summaries are not endorsed by, affiliated
            with, or a substitute for the original works.
          </p>
        </div>

        {/* Collections */}
        {COLLECTIONS.map((collection) => (
          <section key={collection.name} className="mb-12">
            <h2 className="text-2xl font-bold mb-2">{collection.name}</h2>
            <p
              className="text-sm mb-4"
              style={{ color: "var(--color-fg-muted)" }}
            >
              {collection.description}
            </p>

            <div
              className="text-xs mb-6 p-4 rounded"
              style={{ backgroundColor: "var(--color-bg-secondary)" }}
            >
              <p>
                <strong>Source:</strong>{" "}
                <a
                  href={collection.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {collection.source}
                </a>
              </p>
              <p className="mt-1">
                <strong>Authors:</strong> {collection.authors}
              </p>
            </div>

            <ul className="space-y-2">
              {collection.documents.map((doc) => (
                <li key={doc.path}>
                  <Link
                    href={`/context/${doc.path}`}
                    className="text-base hover:underline"
                  >
                    {doc.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}

        <div className="mt-12">
          <Link
            href="/"
            className="text-sm"
            style={{ color: "var(--color-fg-muted)" }}
          >
            ← Back to home
          </Link>
        </div>
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
        const response = await fetch(`/context/${path}.md`);
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
    <article className="container py-8 md:py-12">
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
            className="mt-6 p-4 rounded text-xs"
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
              <em>
                This is an LLM-generated summary for educational purposes, not a
                reproduction of the original work.
              </em>
            </p>
          </div>
        )}

        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: trusted markdown content */}
        <div className="mt-8" dangerouslySetInnerHTML={{ __html: content }} />
      </div>
    </article>
  );
}
