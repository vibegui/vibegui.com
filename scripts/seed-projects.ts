/**
 * Seed Projects for Roadmap
 *
 * Run with: bun run scripts/seed-projects.ts
 */

import { seedProjects, type Project } from "../lib/db/content.ts";

const projects: Project[] = [
  // ONGOING
  {
    id: "anjo-chat",
    title: "anjo.chat",
    tagline: "Brazilian Angel Investor Collective",
    description:
      "A platform where founders submit their startup via a conversational prompt. AI analyzes the pitch and matches it with relevant angel investors from our network. Democratizing access to early-stage funding in Brazil.",
    status: "ongoing",
    icon: "👼",
    coverGradient: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    url: "https://anjo.chat",
    startDate: "2025-01",
    targetDate: "2025-Q1",
    sortOrder: 10,
    tags: ["ai", "fintech", "brazil", "startups"],
    actionPlan: [
      {
        task: "Design landing page with submit flow",
        owner: "me",
        dueDate: "2025-01-05",
      },
      {
        task: "Build prompt-based company intake form",
        owner: "me",
        dueDate: "2025-01-10",
      },
      {
        task: "Create angel investor database schema",
        owner: "me",
        dueDate: "2025-01-12",
      },
      {
        task: "Implement AI matching algorithm",
        owner: "me",
        dueDate: "2025-01-20",
      },
      {
        task: "Onboard first 10 angel investors",
        owner: "me",
        dueDate: "2025-01-25",
      },
      {
        task: "Launch beta with 5 test startups",
        owner: "me",
        dueDate: "2025-01-31",
      },
    ],
  },

  // FUTURE
  {
    id: "bookmarks-whatsapp-submit",
    title: "Bookmarks WhatsApp Submit",
    tagline: "Forward Links to Your Database",
    description:
      "A WhatsApp bot that accepts forwarded links and automatically saves them to the bookmarks database, triggering the enrichment workflow. Just forward any interesting link to the bot and it appears enriched in your bookmarks.",
    status: "future",
    icon: "📲",
    coverGradient: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
    sortOrder: 20,
    tags: ["whatsapp", "automation", "ai", "mcp"],
  },
  {
    id: "bookmarks-mcp-studio",
    title: "Bookmarks on MCP App Studio",
    tagline: "Port to MCP Workflows",
    description:
      "Port the vibegui Bookmarks enrichment pipeline to MCP App Studio Workflows. Make the scrape → search → analyze pipeline reusable and configurable through the visual workflow builder.",
    status: "future",
    icon: "🔄",
    coverGradient: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
    sortOrder: 30,
    tags: ["mcp", "workflows", "automation"],
  },
  {
    id: "whatsapp-mcp-bridge",
    title: "WhatsApp MCP Bridge",
    tagline: "Complete MCP-to-WhatsApp Integration",
    description:
      "Full MCP Mesh integration with WhatsApp Web scraper and remote controller. Includes a delicious 'Inbox Zero' agentic mode that helps process and respond to messages intelligently.",
    status: "future",
    icon: "💬",
    coverGradient: "linear-gradient(135deg, #075e54 0%, #25D366 100%)",
    sortOrder: 40,
    tags: ["whatsapp", "mcp", "agents", "automation"],
  },

  // COMPLETED
  {
    id: "vibegui-bookmarks",
    title: "vibegui Bookmarks",
    tagline: "AI-Enriched Bookmark Manager",
    description:
      "Every bookmark is scraped, searched, and analyzed by AI. Generates tailored insights for developers, founders, and investors. 305 bookmarks enriched at $0.04 each.",
    status: "completed",
    icon: "🔖",
    coverGradient: "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
    url: "/bookmarks",
    completedDate: "2025-12-28",
    sortOrder: 100,
    tags: ["ai", "productivity", "mcp"],
  },
  {
    id: "vibegui-v1",
    title: "vibegui.com v1",
    tagline: "Personal Website & Blog",
    description:
      "Built with Vite, React, and decoCMS. SQLite-backed content management with MCP integration. Dark theme, mobile-responsive, performance-optimized.",
    status: "completed",
    icon: "🌐",
    coverGradient: "linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 100%)",
    url: "/",
    completedDate: "2025-12-20",
    sortOrder: 110,
    tags: ["web", "react", "mcp"],
  },
];

console.log("🌱 Seeding projects...");
const count = seedProjects(projects);
console.log(`✅ Seeded ${count} projects`);
