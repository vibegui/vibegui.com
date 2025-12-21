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
