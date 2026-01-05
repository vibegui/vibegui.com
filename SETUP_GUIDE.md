# AI Agent Setup Guide

> **For humans and AI agents.** Follow these steps in order to set up a complete local AI development environment with MCP Mesh, browser integration, and workflow automation.

## Overview

This guide sets up:

1. **MCP Mesh** (PostgreSQL) — Control plane for all MCP traffic
2. **OpenRouter MCP** — LLM access (200+ models, vision, image generation)
3. **Perplexity MCP** — Web-grounded research and search
4. **Mesh Bridge** — Browser automation via Chrome extension
5. **Pilot** — Workflow-driven AI agent
6. **Workflows** — JSON-based automation pipelines

```
┌─────────────────────────────────────────────────────────────────────┐
│                              MCP MESH                                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        EVENT BUS                              │   │
│  │                                                               │   │
│  │   user.message.received ◄─── Bridge publishes                 │   │
│  │   agent.response.* ────────► Bridge/Pilot subscribes          │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              ▲                                       │
│                              │                                       │
│  ┌──────────┐   ┌────────────┴────────────┐   ┌────────────────┐    │
│  │  Pilot   │   │      mesh-bridge        │   │   Other MCPs   │    │
│  │          │◄──│                         │──►│                │    │
│  │ Workflows│   │   Chrome Extension      │   │  • OpenRouter  │    │
│  │ Tasks    │   │   WhatsApp ↔ Events     │   │  • Perplexity  │    │
│  └──────────┘   └─────────────────────────┘   └────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

- **Node.js** ≥ 22.0.0
- **Bun** (for local MCPs): `curl -fsSL https://bun.sh/install | bash`
- **Docker** and **Docker Compose** (for PostgreSQL)
- **Chrome browser** (for Mesh Bridge extension)
- **API Keys:**
  - OpenRouter: https://openrouter.ai/keys
  - Perplexity: https://perplexity.ai/settings/api

---

## Step 1: Start MCP Mesh with PostgreSQL

> **Why PostgreSQL?** The Event Bus requires PostgreSQL for reliable pub/sub with LISTEN/NOTIFY. SQLite won't work for event-driven workflows.

### Option A: Docker Compose (Recommended)

```bash
# Create a directory for Mesh
mkdir -p ~/mesh && cd ~/mesh

# Download docker-compose file
curl -O https://raw.githubusercontent.com/decocms/mesh/main/deploy/docker-compose.postgres.yml

# Create auth config
cat > auth-config.json << 'EOF'
{
  "socialProviders": []
}
EOF

# Create .env file
cat > .env << 'EOF'
BETTER_AUTH_SECRET=your-secret-key-change-this-to-random-string
BETTER_AUTH_URL=http://localhost:3000
BASE_URL=http://localhost:3000
POSTGRES_USER=mesh_user
POSTGRES_PASSWORD=change-this-password
POSTGRES_DB=mesh_db
EOF

# Start Mesh with PostgreSQL
docker compose -f docker-compose.postgres.yml up -d
```

### Option B: npx (Quick local testing)

```bash
npx @decocms/mesh
```

> ⚠️ This uses SQLite by default. For Event Bus features (Pilot, Bridge workflows), you need PostgreSQL.

### Verify Mesh is running

Open http://localhost:3000 — you should see the Mesh UI.

Create an account (first user becomes admin).

---

## Step 2: Add OpenRouter MCP

The OpenRouter MCP provides access to 200+ LLMs with vision and image generation.

### Get the package

```bash
npx @firstdoit/openrouter-mcp-multimodal
```

### Add to Mesh

1. Go to **Connections** in Mesh UI
2. Click **Add Connection** → **Custom Command**
3. Configure:

| Field | Value |
|-------|-------|
| Name | `OpenRouter` |
| Command | `npx` |
| Arguments | `@firstdoit/openrouter-mcp-multimodal` |

4. Add environment variable:
   - `OPENROUTER_API_KEY` = `your-openrouter-api-key`

5. Click **Save**

### Available Tools

- `mcp_openrouter_chat_completion` — Chat with any model
- `mcp_openrouter_analyze_image` — Vision/image analysis
- `mcp_openrouter_multi_image_analysis` — Analyze multiple images
- `generate_image` — Generate images (Gemini 2.5 Flash Image)
- `search_models` — Search available models
- `get_model_info` — Get model details
- `validate_model` — Check if model ID is valid

> **To publish a new version:** `cd openrouter-mcp-multimodal && npm version patch && npm publish`

---

## Step 3: Add Perplexity MCP

The official Perplexity MCP server provides web-grounded answers with citations.

### Get the package

```bash
npx @perplexity-ai/mcp-server
```

### Add to Mesh

1. Go to **Connections** in Mesh UI
2. Click **Add Connection** → **Custom Command**
3. Configure:

| Field | Value |
|-------|-------|
| Name | `Perplexity` |
| Command | `npx` |
| Arguments | `@perplexity-ai/mcp-server` |

4. Add environment variable:
   - `PERPLEXITY_API_KEY` = `your-perplexity-api-key`

5. Click **Save**

### Available Tools

- `perplexity_ask` — Simple question with web-grounded answer
- `perplexity_search` — Web search with ranked results
- `perplexity_chat` — Multi-turn conversation with context

---

## Step 4: Add Mesh Bridge

Mesh Bridge turns browser events into MCP Event Bus messages.

### Install

```bash
# Clone the repo
git clone https://github.com/firstdoit/mesh-bridge.git
cd mesh-bridge
bun install
```

### Add Chrome Extension

1. Open Chrome and go to `chrome://extensions`
2. Enable **Developer mode** (toggle in top-right)
3. Click **Load unpacked**
4. Select the `mesh-bridge/extension/` folder

You should see the Mesh Bridge extension icon appear.

### Add to Mesh as Connection

1. Go to **Connections** → **Add Connection** → **Custom Command**
2. Configure:

| Field | Value |
|-------|-------|
| Name | `Mesh Bridge` |
| Command | `bun` |
| Arguments | `run`, `start` |
| Working Directory | `/path/to/mesh-bridge` |

3. Configure bindings:
   - Add **EVENT_BUS** binding

### Test WhatsApp Integration

1. Open https://web.whatsapp.com
2. Go to your **self-chat** ("Message Yourself")
3. Send a message — the Bridge will publish events to the Event Bus

---

## Step 5: Add Pilot

Pilot is the workflow-driven AI agent that processes events and executes multi-step tasks.

### Install

```bash
# Clone the MCPs repo (if not already)
git clone https://github.com/decocms/mcps.git
cd mcps/pilot

# Install dependencies
bun install

# Create directories for tasks and workflows
mkdir -p ~/Projects/tasks
mkdir -p ~/Projects/workflows
```

### Configure Environment

```bash
cat > .env << 'EOF'
# Storage paths
TASKS_DIR=~/Projects/tasks
CUSTOM_WORKFLOWS_DIR=~/Projects/workflows

# Default models (via OpenRouter)
FAST_MODEL=google/gemini-2.5-flash
SMART_MODEL=anthropic/claude-sonnet-4

# Default workflow
DEFAULT_WORKFLOW=fast-router
EOF
```

### Add to Mesh as Connection

1. Go to **Connections** → **Add Connection** → **Custom Command**
2. Configure:

| Field | Value |
|-------|-------|
| Name | `Pilot` |
| Command | `bun` |
| Arguments | `run`, `start` |
| Working Directory | `/path/to/mcps/pilot` |

3. Configure bindings:
   - Add **LLM** binding → Select `OpenRouter`
   - Add **CONNECTION** binding → Enable tool discovery
   - Add **EVENT_BUS** binding → For pub/sub

---

## Step 6: Create a Workflow

Workflows are JSON files that define multi-step automation.

### Example: Research and Draft Article

Create `~/Projects/workflows/research-and-write.json`:

```json
{
  "id": "research-and-write",
  "title": "Research and Write Article",
  "description": "Research a topic with Perplexity and write an article using OpenRouter",
  "steps": [
    {
      "name": "research",
      "description": "Research the topic using Perplexity",
      "action": {
        "type": "llm",
        "prompt": "Research the following topic thoroughly:\n\n@input.topic\n\n**TOOL USAGE:**\nCall: `perplexity_search({ \"query\": \"@input.topic\" })`\n\nGather:\n- Key facts and statistics\n- Recent developments\n- Expert opinions\n- Multiple perspectives\n\nReturn a comprehensive research summary.",
        "model": "fast",
        "tools": ["perplexity_search"],
        "maxIterations": 10
      },
      "input": {
        "topic": "@input.topic"
      }
    },
    {
      "name": "write_draft",
      "description": "Write the article based on research",
      "action": {
        "type": "llm",
        "prompt": "Write a well-structured article based on this research:\n\n**Topic:** @input.topic\n\n**Research:**\n@research.response\n\nWrite a compelling article that:\n- Has a strong hook\n- Is well-organized with clear sections\n- Includes specific examples from the research\n- Has a clear conclusion\n\nOutput the full article in markdown format.",
        "model": "smart",
        "maxIterations": 1
      },
      "input": {
        "topic": "@input.topic",
        "research": "@research.response"
      }
    },
    {
      "name": "save_to_file",
      "description": "Save the article to a file",
      "action": {
        "type": "llm",
        "prompt": "Save this article to a markdown file.\n\n**Article:**\n@write_draft.response\n\n**TOOL USAGE:**\nCall: `WRITE_FILE({ \"path\": \"/tmp/article-@input.timestamp.md\", \"content\": \"@write_draft.response\" })`\n\nConfirm the file was saved.",
        "model": "fast",
        "tools": ["WRITE_FILE"],
        "maxIterations": 3
      },
      "input": {
        "content": "@write_draft.response",
        "timestamp": "@input.timestamp"
      }
    },
    {
      "name": "format_response",
      "description": "Format the final response",
      "action": {
        "type": "template",
        "template": "✅ **Article Complete!**\n\n📝 **@input.topic**\n\n---\n\n@write_draft.response\n\n---\n\n📁 Saved to: `/tmp/article-@input.timestamp.md`"
      },
      "input": {
        "topic": "@input.topic",
        "content": "@write_draft.response",
        "timestamp": "@input.timestamp"
      }
    }
  ],
  "inputSchema": {
    "type": "object",
    "required": ["topic"],
    "properties": {
      "topic": {
        "type": "string",
        "description": "The topic to research and write about"
      },
      "timestamp": {
        "type": "string",
        "description": "Timestamp for file naming (auto-generated)"
      }
    }
  }
}
```

### Workflow Step Types

| Type | Description |
|------|-------------|
| `llm` | Call LLM with prompt, optional tools |
| `tool` | Call a specific MCP tool directly |
| `template` | String interpolation for formatting |

### Reference Syntax

- `@input.fieldName` — Workflow input
- `@step_name.response` — Previous step output
- `@config.modelId` — Configuration value

---

## Step 7: Test via WhatsApp

Now for the magic — trigger workflows from WhatsApp.

### Verify Everything is Connected

1. Check Mesh UI → all connections should show **Connected**
2. Check Pilot logs for `Subscribed to user.message.received`
3. Check Bridge logs for WebSocket connection

### Send a Message

1. Open https://web.whatsapp.com → your self-chat
2. Type: `research and write about MCP protocol`
3. Pilot will:
   - Receive the event from Bridge
   - Route to the workflow
   - Execute research with Perplexity
   - Write the article with OpenRouter
   - Save to file
   - Respond via Bridge back to WhatsApp

### Available Commands

| Command | Action |
|---------|--------|
| `research <topic>` | Research using Perplexity |
| `write about <topic>` | Full research + draft workflow |
| `list tasks` | See recent tasks |
| `list workflows` | See available workflows |
| `check <taskId>` | Check task status |

---

## Troubleshooting

### Event Bus Not Working

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check Mesh logs
docker logs deco-mcp-mesh -f
```

### Pilot Not Receiving Events

1. Verify EVENT_BUS binding is configured
2. Check Pilot has subscribed: look for `Subscribed to user.message.received` in logs
3. Verify Bridge is publishing events

### Bridge Extension Disconnects

The extension auto-reconnects. If you see "Extension context invalidated", the page will auto-reload.

### WhatsApp Not Responding

1. Must be in **self-chat** ("Message Yourself")
2. Check Bridge WebSocket is connected (port 9999)
3. Check Pilot is processing events

---

## Quick Reference

### NPX Commands

```bash
# Start Mesh
npx @decocms/mesh

# OpenRouter MCP
npx @firstdoit/openrouter-mcp-multimodal

# Perplexity MCP (official)
npx @perplexity-ai/mcp-server

# Publish new OpenRouter version
cd openrouter-mcp-multimodal && npm version patch && npm publish
```

### Mesh Connections Summary

| Name | Type | Command/URL |
|------|------|-------------|
| OpenRouter | Custom Command | `npx @firstdoit/openrouter-mcp-multimodal` |
| Perplexity | Custom Command | `npx @perplexity-ai/mcp-server` |
| Mesh Bridge | Custom Command | `bun run start` (in mesh-bridge/) |
| Pilot | Custom Command | `bun run start` (in mcps/pilot/) |

### File Locations

```
~/Projects/
├── tasks/           # Pilot task storage
├── workflows/       # Custom workflows
├── mesh-bridge/     # Browser bridge
└── mcps/
    └── pilot/       # AI agent
```

---

## Next Steps

1. **Create more workflows** — Explore `~/Projects/workflows/` examples
2. **Add more MCPs** — Browse https://github.com/decocms/mcps
3. **Build custom integrations** — Mesh Bridge supports adding new domains
4. **Deploy to production** — Use `docker-compose.postgres.yml` with proper secrets

---

## License

MIT

