/**
 * Page Header Component
 *
 * Shared header component for pages.
 * When no props are passed, shows the default author/blog introduction.
 * When title/subtitle are passed, shows a custom page header.
 */

interface PageHeaderProps {
  title?: string;
  subtitle?: string;
}

export function PageHeader({ title, subtitle }: PageHeaderProps = {}) {
  // Custom header for specific pages
  if (title) {
    return (
      <div className="mb-6">
        <h1
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--color-fg)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p style={{ color: "var(--color-fg-muted)" }}>{subtitle}</p>
        )}
      </div>
    );
  }

  // Personal introduction for the writing home
  return (
    <section
      className="mb-8 md:mb-12 pb-8 md:pb-12 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      <div className="flex flex-col-reverse sm:flex-row sm:items-start gap-7 sm:gap-10">
        <div className="flex-1">
          <p
            className="text-sm mb-4"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Guilherme Rodrigues · Rio de Janeiro
          </p>
          <h1
            className="text-4xl md:text-5xl"
            style={{ color: "var(--color-fg)" }}
          >
            Ideas I wish I had earlier.
          </h1>
          <p
            className="mt-5 text-base md:text-lg leading-relaxed"
            style={{ color: "var(--color-fg-muted)" }}
          >
            I build software and companies, currently as co-founder of{" "}
            <a
              href="https://decocms.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              deco
            </a>
            . This is where I work through the distinctions that shape how I
            lead, build, and imagine possible futures—for technology, Brazil,
            and myself.
          </p>
          <nav
            className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm"
            aria-label="Personal links"
          >
            <a
              href="https://www.linkedin.com/in/vibegui/"
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
            <a
              href="https://github.com/vibegui"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>
          </nav>
        </div>
        <img
          src="/images/guilherme-rodrigues.jpeg"
          alt="Guilherme Rodrigues"
          width="800"
          height="800"
          className="w-28 h-28 md:w-32 md:h-32 rounded-full object-cover shrink-0"
          style={{ border: "1px solid var(--color-border)" }}
        />
      </div>
    </section>
  );
}
