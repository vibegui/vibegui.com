// Guilherme's instance of Worldview.
//
// Everything specific to *this* worldview lives in this folder: the declared
// future (../declared-future.md), its structure (../worldview.json), the
// bindings (../wrangler.jsonc), and the adapters wired below. All behaviour —
// the MCP server, the tools, the schema, the browser UI — comes from the
// library.
//
// Prose is markdown and structure is JSON, on purpose: the declared future is
// the thing I edit most, and it was unreadable as an escaped JSON string.
//
// Both are imported as values, so they live in this repo's git — changing my
// future is a commit here, not a dependency bump.

import { createWorldview } from "worldview";
import declaredFuture from "../declared-future.md";
import declaration from "../worldview.json" with { type: "json" };

// One import per project: a Worker has no glob import, and generating this list
// would put a build step back into a folder that is meant to be config.
import anjoChat from "../projects/anjo-chat.md";
import decoFlights from "../projects/deco-flights.md";
import decoIos from "../projects/deco-ios.md";
import decoStudio from "../projects/deco-studio.md";
import decocms from "../projects/decocms.md";
import holocard from "../projects/holocard.md";
import mangabeiraChat from "../projects/mangabeira-chat.md";
import personalCrm from "../projects/personal-crm.md";
import personalFiles from "../projects/personal-files.md";
import runtime from "../projects/runtime.md";
import vibegui from "../projects/vibegui.md";
import vigia from "../projects/vigia.md";
import worldview from "../projects/worldview.md";
import zelador from "../projects/zelador.md";

export default createWorldview({
  declaration,
  declaredFuture,

  // Structure is intent, so it is declared here in git. Lifecycle, order,
  // progress, and evidence stay in D1, where they change week to week.
  projects: [
    anjoChat,
    decoFlights,
    decoIos,
    decoStudio,
    decocms,
    holocard,
    mangabeiraChat,
    personalCrm,
    personalFiles,
    runtime,
    vibegui,
    vigia,
    worldview,
    zelador,
  ],

  site: {
    title: "vibegui \u2014 Guilherme Rodrigues sobre IA, lideran\u00e7a e software",
    description:
      "Textos de Guilherme Rodrigues sobre lideran\u00e7a, IA, software, Brasil e futuros poss\u00edveis.",
    favicon: "https://vibegui.com/favicon.ico",
  },

  hero: {
    eyebrow: "Guilherme Rodrigues \u00b7 Rio de Janeiro",
    title: "Ideas I wish I had earlier.",
    intro:
      "I build software and companies, currently as co-founder of [deco](https://deco.cx). This is where I work through the distinctions that shape how I lead, build, and imagine possible futures\u2014for technology, Brazil, and myself.",
    links: [
      { label: "LinkedIn", href: "https://www.linkedin.com/in/guilhermerodrigues/" },
      { label: "GitHub", href: "https://github.com/vibegui" },
    ],
    avatar: "https://vibegui.com/images/guilherme-rodrigues.jpeg",
  },

  // Optional module: this instance publishes to vibegui.com, so the writing
  // corpus is readable as prior art ("have I already said this?"). An instance
  // with no public writing omits this key entirely.
  publicWriting: {
    siteOrigin: "https://vibegui.com",
    manifestPath: "/content/manifest.json",
  },

  // Optional module: the AI-curated library. Has a public HTTP surface, so it
  // is opt-in per instance rather than always-on.
  bookmarks: {
    publicRoutes: true,
  },

  // Optional module: first-party analytics for my sites, backing
  // SITES_OVERVIEW / SITE_METRICS. The static site's beacon posts here
  // (../functions/_middleware.ts), so this instance must keep it enabled.
  analytics: {
    sites: ["vibegui.com", "poesiadairene.com", "buscamalvados.com"],
  },
});
