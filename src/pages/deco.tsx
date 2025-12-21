/**
 * deco Page
 *
 * The journey of deco CMS and invitation to join.
 *
 * TODO: Expand with full content
 */

export function Deco() {
  return (
    <article className="container py-8 md:py-12">
      <header className="mb-12">
        <h1 className="text-3xl md:text-4xl font-bold">deco CMS</h1>
        <p className="mt-4 text-xl text-[var(--color-fg-muted)] dark:text-[var(--color-dark-fg-muted)]">
          Building the future of AI-native applications
        </p>
      </header>

      <div className="prose mx-auto">
        <div className="p-6 bg-[var(--color-bg-secondary)] dark:bg-[var(--color-dark-bg-secondary)] rounded-lg mb-8">
          <p className="text-sm text-[var(--color-fg-muted)] dark:text-[var(--color-dark-fg-muted)] italic">
            🚧 This page is under construction. Full story coming soon.
          </p>
        </div>

        <p>
          <a
            href="https://decocms.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            deco CMS
          </a>{" "}
          is a Context Management System—a complete suite to build and evolve
          MCP servers. We're democratizing the creation of governable AI agents.
        </p>

        <h2>What We're Building</h2>

        <ul>
          <li>
            <strong>MCP Mesh:</strong> The open-source control plane for MCP
            traffic. Route, govern, and observe all your AI connections.
          </li>
          <li>
            <strong>MCP Studio:</strong> Build MCP capabilities with no-code
            admin and full SDK support.
          </li>
          <li>
            <strong>MCP Store:</strong> Discover and install pre-built MCP apps.
          </li>
        </ul>

        <h2>Our Principles</h2>

        <ol>
          <li>
            <strong>Open standards.</strong> We use MCP, React, TypeScript. No
            vendor lock-in. Your knowledge and code are yours forever.
          </li>
          <li>
            <strong>Deploy anywhere.</strong> Cloud, edge, on-premise. Bring
            your own keys and models.
          </li>
          <li>
            <strong>Production-grade.</strong> From idea to production in days,
            with real governance and security.
          </li>
        </ol>

        <h2>Join Us</h2>

        <p>
          We're always looking for exceptional people who want to build the
          future of AI applications.
        </p>

        <div className="flex flex-wrap gap-4 mt-6">
          <a
            href="https://decocms.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-[var(--color-accent)] dark:bg-[var(--color-dark-accent)] text-white dark:text-[var(--color-dark-bg)] rounded-lg font-medium hover:opacity-90 transition-opacity"
          >
            Try deco →
          </a>
          <a
            href="https://github.com/decocms"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-[var(--color-border)] dark:border-[var(--color-dark-border)] rounded-lg font-medium hover:bg-[var(--color-bg-secondary)] dark:hover:bg-[var(--color-dark-bg-secondary)] transition-colors"
          >
            GitHub
          </a>
          <a
            href="https://decocms.com/discord"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-[var(--color-border)] dark:border-[var(--color-dark-border)] rounded-lg font-medium hover:bg-[var(--color-bg-secondary)] dark:hover:bg-[var(--color-dark-bg-secondary)] transition-colors"
          >
            Discord
          </a>
        </div>
      </div>
    </article>
  );
}
