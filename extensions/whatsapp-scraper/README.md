# WhatsApp Web MCP Bridge

A Chrome extension that bridges WhatsApp Web to MCP (Model Context Protocol), enabling AI agents to interact with your WhatsApp conversations.

## Features

### 🔌 MCP Bridge
- **Real-time WebSocket connection** to local MCP server
- **Full tool suite** for AI agents to control WhatsApp
- **Auto-reconnect** if connection drops

### 📋 Manual Scraping (Side Panel UI)
- Extract and export message history
- Filter by sender: All / Only from me / Only from others
- Content filters: Text messages, media captions
- Auto-scroll to load older messages
- Export to text file

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extensions/whatsapp-scraper` folder

## MCP Bridge Setup

### 1. Start the MCP Server

```bash
cd /path/to/vibegui.com
bun run mcp:dev
```

The server starts a WebSocket on `ws://localhost:9999`.

### 2. Open WhatsApp Web

Navigate to [web.whatsapp.com](https://web.whatsapp.com) in Chrome.

### 3. Verify Connection

Click the extension icon to open the side panel, go to the **MCP** tab. You should see:
- **"Connected to MCP Server"** with a pulsing green dot

### 4. Use via AI Agent

In Cursor, Claude Desktop, or any MCP-compatible client, you can now use these tools:

## Available MCP Tools

| Tool | Description |
|------|-------------|
| `WHATSAPP_STATUS` | Check if extension is connected and a chat is open |
| `WHATSAPP_LIST_CHATS` | List visible chats in sidebar with last messages |
| `WHATSAPP_SEARCH_CHATS` | Search for a chat by name or phone number |
| `WHATSAPP_CLEAR_SEARCH` | Clear search and return to full chat list |
| `WHATSAPP_OPEN_CHAT` | Open a specific chat by name (partial match) |
| `WHATSAPP_GET_CURRENT_CHAT` | Get info about currently open chat |
| `WHATSAPP_READ_MESSAGES` | Read currently visible messages |
| `WHATSAPP_SCROLL_UP` | Scroll up to load older messages |
| `WHATSAPP_SCROLL_DOWN` | Scroll down to see newer messages |
| `WHATSAPP_SCRAPE` | Full history scrape with auto-scroll |

### Example Usage (via AI)

```
"List my WhatsApp chats"
→ Calls WHATSAPP_LIST_CHATS

"Open the chat with João"
→ Calls WHATSAPP_OPEN_CHAT with name="João"

"Read the last messages"
→ Calls WHATSAPP_READ_MESSAGES

"Scroll up and read older messages"
→ Calls WHATSAPP_SCROLL_UP then WHATSAPP_READ_MESSAGES

"Scrape the full conversation history"
→ Calls WHATSAPP_SCRAPE with scrollLimit=100
```

## Architecture

```
┌─────────────────────┐     MCP      ┌──────────────────────┐
│   AI Agent          │◄────────────►│  vibegui.com MCP     │
│  (Cursor/Claude)    │   Protocol   │  Server (Bun)        │
└─────────────────────┘              └──────────┬───────────┘
                                                │
                                     WebSocket  │ :9999
                                                │
                                     ┌──────────▼───────────┐
                                     │  Chrome Extension    │
                                     │  (content.js)        │
                                     └──────────┬───────────┘
                                                │
                                       DOM      │
                                                │
                                     ┌──────────▼───────────┐
                                     │  WhatsApp Web        │
                                     │  (web.whatsapp.com)  │
                                     └──────────────────────┘
```

## Files

```
extensions/whatsapp-scraper/
├── manifest.json      # Extension config (MV3)
├── background.js      # Service worker (handles icon clicks)
├── content.js         # Main script (panel UI + scraping + MCP bridge)
├── panel.css          # Side panel styles
├── icon.svg           # Extension icon
└── README.md          # This file
```

## Security

- WebSocket only on `localhost` (127.0.0.1)
- No external network access from extension
- User must explicitly have WhatsApp Web open
- Extension only reads messages, doesn't send (read-only)

## Troubleshooting

### "Not connected" in MCP tab
- Ensure `bun run mcp:dev` is running in vibegui.com
- Check console for WebSocket errors
- Click "Reconnect" button

### Side panel doesn't open
- Make sure you're on web.whatsapp.com
- Refresh the page after installing/updating

### "No chat open" error
- Select a chat in WhatsApp before reading messages

### Messages not found
- WhatsApp DOM might have changed - check console for errors
- Try updating selectors in content.js

## Development

```bash
# Watch MCP server
cd vibegui.com
bun run mcp:dev

# After changing extension files, reload in chrome://extensions
```

## Version History

- **1.0.0** - Full MCP Bridge with WebSocket connection
- **0.3.0** - Side panel UI for scraping
- **0.2.0** - Basic message extraction
- **0.1.0** - Initial popup version
