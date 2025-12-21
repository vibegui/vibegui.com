/**
 * Commitment Page
 *
 * Explains Guilherme's top-level commitment:
 * Making Brazil a global technology protagonist.
 */

export function Commitment() {
  return (
    <article className="container py-4 md:py-6">
      <div>
        {/* About Section */}
        <section
          className="mb-6 p-6 rounded-lg"
          style={{ backgroundColor: "var(--color-bg-secondary)" }}
        >
          <h2 className="text-2xl font-semibold mb-4">About the author</h2>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <img
              src="/images/profile-2025-12.png"
              alt="Guilherme Rodrigues"
              className="w-64 h-64 rounded-md object-cover shrink-0"
              style={{ border: "1px solid var(--color-border)" }}
            />
            <p
              className="prose pl-2"
              style={{ color: "var(--color-fg-muted)" }}
            >
              <strong>Guilherme Rodrigues</strong> is a software engineer and
              entrepreneur from Rio de Janeiro, Brazil. Co-founder and CEO of{" "}
              <a
                href="https://decocms.com/?utm_source=vibegui.com&utm_campaign=commitment"
                target="_blank"
                rel="noopener noreferrer"
              >
                deco CMS
              </a>
              , an open-source MCP Mesh platform. Former Staff Engineer at VTEX
              (9 years), where he helped build the platform from early stage to
              NYSE IPO. Co-founder of{" "}
              <a
                href="https://www.movtech.org"
                target="_blank"
                rel="noopener noreferrer"
              >
                Movimento Tech 2030
              </a>
              , a coalition that has impacted 3M+ students and created 7,000+
              tech jobs in Brazil. Founding donor of{" "}
              <a
                href="https://www.rioendowment.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                RIO Endowment
              </a>
              . PUC-Rio alumni. <br /> <em>Alis Grave Nil.</em>
              <div className="flex gap-3 mt-3">
                <a
                  href="https://www.linkedin.com/in/vibegui/"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                <a
                  href="https://x.com/vibegui_"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="X (Twitter)"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z" />
                  </svg>
                </a>
                <a
                  href="https://github.com/vibegui"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="GitHub"
                  className="opacity-60 hover:opacity-100 transition-opacity"
                >
                  <svg
                    role="img"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-5 h-5"
                  >
                    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                  </svg>
                </a>
              </div>
            </p>
          </div>
        </section>

        <header className="mb-12">
          <h1 className="text-3xl md:text-4xl font-bold">Commitment</h1>
          <p
            className="mt-4 text-xl"
            style={{ color: "var(--color-fg-muted)" }}
          >
            Brazil as a global technology protagonist
          </p>
        </header>

        <div className="prose">
          <p>
            At 25, I was living in Sweden — one of the most organized, stable,
            and predictable countries in the world. I worked at Tictail (later
            acquired by Shopify), a Swedish e-commerce startup, surrounded by
            cutting-edge technology, mature institutions, and an almost absolute
            sense of security.
          </p>

          <p>
            And it was precisely there, in the perfect center of the "first
            world," that I discovered this wasn't the game I wanted to play.
          </p>

          <p>
            While everything seemed to work perfectly, something in me didn't. I
            realized that, as much as that environment offered comfort and
            predictability, it didn't offer the kind of purpose I was seeking. I
            wanted to be where there was still much to be built. Where talent
            wasn't just another brick in a ready-made structure, but a real
            force of transformation.
          </p>

          <p>
            <strong>
              I wanted to return to Brazil — not because it was easier, but
              because it was more important.
            </strong>
          </p>

          <h2>From Sweden to Brazil: Building Where It Matters</h2>

          <p>
            When I returned, I rejoined VTEX as a software engineer. There, I
            experienced firsthand what it means to build technology at scale
            from Brazil. We helped create an e-commerce platform that today
            processes billions in transactions and competes globally with the
            largest players in the market. It was a long journey to the IPO on
            the New York Stock Exchange, but it was worth every drop of sweat.
          </p>

          <p>
            It was at VTEX that I understood something fundamental: Brazil
            doesn't just need to consume technology from abroad — we can create
            technology that the whole world uses.
          </p>

          <p>
            But it also became clear that no one changes a country alone. The
            transformation I sought didn't depend only on a successful company,
            but on creating technological capacity at scale — training people,
            opening opportunities, democratizing access to the knowledge that
            transforms careers.
          </p>

          <h2>Understanding That Purpose Is Collective</h2>

          <p>
            This realization led me and a team of similarly-committed people to
            found{" "}
            <a
              href="https://www.movtech.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              Movimento Tech
            </a>{" "}
            in 2022, where we united for a future worth building: making
            technology a lever for productive inclusion in Brazil.
          </p>

          <p>
            Movimento Tech 2030 was born with a clear mission: to create real
            opportunities for those who never had access to this type of
            trajectory. Today, we are a coalition that has already impacted more
            than 3 million young people, generated more than 7,000 jobs in the
            tech sector, and moves hundreds of millions of reais in salaries and
            investments.
          </p>

          <p>
            One of our main projects is Maratona Tech — Brazil's largest
            technology olympiad, created to spark students' interest in
            technology. It's not just a competition, it's a gateway to a
            universe of possibilities that previously seemed unattainable for
            millions of young Brazilians.
          </p>

          <blockquote>
            <p>
              Talent is equally distributed; opportunity is not. And technology
              is the most powerful bridge to correct this asymmetry.
            </p>
          </blockquote>

          <h2>Building deco CMS</h2>

          <p>
            Over the past years, I understood that my purpose was not just
            creating technology — but helping unlock Brazil's full creative
            potential through technology.
          </p>

          <p>
            That's a main goal of{" "}
            <a
              href="https://decocms.com/?utm_source=vibegui.com&utm_campaign=commitment-body"
              target="_blank"
              rel="noopener noreferrer"
            >
              deco CMS
            </a>{" "}
            — a platform that democratizes software creation through artificial
            intelligence, in Brazil and everywhere else.
          </p>

          <p>
            We're building the AI application platform that allows anyone —
            developers, operators, entrepreneurs — to build complete LLM-powered
            applications quickly and professionally. We're not talking about
            prototypes or demos that never go to production. We're talking about
            autonomous companies created with real AI software, running in
            production, with governance, security, and scalability.
          </p>

          <h3>deco is based on principles I believe are fundamental:</h3>

          <ul className="green-bullets">
            <li>
              <strong>Agent-first, MCP-native.</strong> Built from the ground up
              for autonomous companies. Every feature is designed to optimize
              the context and tools available to AI agents — because your agents
              are only as good as the context and tools they have.
            </li>
            <li>
              <strong>Deploy anywhere.</strong> Our platform runs on the
              infrastructure you choose — cloud, edge, on-premise. You bring
              your own keys, your own AI models. Own your code, your data and
              your Context.
            </li>
            <li>
              <strong>Open source.</strong> We're starting by{" "}
              <a
                href="https://decocms.com/mesh?utm_source=vibegui.com&utm_campaign=commitment-mesh"
                target="_blank"
                rel="noopener noreferrer"
              >
                open-sourcing our MCP Mesh
              </a>{" "}
              — a secure control plane to manage all your MCPs and optimize your
              production agents. It handles auth, policy, observability, and
              traffic routing so you can deploy AI agents with enterprise-grade
              governance. Interested? Star us on{" "}
              <a
                href="https://github.com/decocms/mesh"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>{" "}
              and deploy your own MCP Mesh in 5 minutes.
            </li>
          </ul>

          <h2>The Game Worth Playing</h2>

          <p>
            When I look back — from Tictail in Sweden to VTEX in Brazil, from
            Movimento Tech to deco CMS — I see a common thread:
          </p>

          <p>
            <strong>
              I want to be where I can contribute so that Brazil realizes its
              technological potential.
            </strong>
          </p>

          <p>
            Not because it's easy. Not because it's guaranteed. But because it's
            possible.
          </p>

          <p>
            And this goes far beyond me. It's a movement involving founders,
            engineers, designers, educators, investors, communities, and
            institutions — all seeking to transform Brazil into a global
            protagonist, not a supporting actor.
          </p>

          <p>
            Brazil has everything to be a global technological power — we have
            talent, creativity, scale. What's often missing is opportunity and
            infrastructure.
          </p>

          <p>
            That's what we're building, together, and I couldn't be in a better
            place to make a difference.
          </p>

          <p>
            <strong>
              It's a long-term game. A country-building game. And it's exactly
              the kind of game worth playing.
            </strong>
          </p>

          <small>
            <em>
              If you want to build this future together, email us at{" "}
              <a href="mailto:builders@decocms.com">builders@decocms.com</a>
            </em>
          </small>
        </div>
      </div>
    </article>
  );
}
