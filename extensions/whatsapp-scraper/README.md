# WhatsApp Web MCP

A Chrome extension with a side panel UI for scraping messages and controlling WhatsApp Web via MCP.

## Features

- **Side Panel UI**: Opens inside WhatsApp Web, symmetrical to the chat list
- **Two Tabs**:
  - **Scrape**: Extract and export message history
  - **MCP (soon)**: Local MCP server for agentic WhatsApp access
- **Filter by sender**: All messages, only from me, or only from others
- **Content filters**: Text messages, media captions
- **Minimum length**: Skip short messages
- **Auto-scroll**: Automatically scrolls up to load older messages
- **Export options**: Auto-download or custom file picker

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extensions/whatsapp-scraper` folder

## Usage

1. Open [WhatsApp Web](https://web.whatsapp.com)
2. Open the chat you want to scrape
3. **Click the extension icon** in Chrome toolbar to toggle the side panel
4. Configure filters in the **Scrape** tab:
   - **Filter messages**: All / Only from me / Only from others
   - **Content filter**: Text messages / Media captions
   - **Minimum length**: Skip messages shorter than N characters
   - **Scroll limit**: How many times to scroll up (more = older messages)
   - **Filename**: Template with `{chatName}` and `{date}` placeholders
5. Click **Start Scraping**
6. Wait for completion (watch progress in status bar)
7. File auto-downloads when complete (or use Export button)

## MCP Tab (Coming Soon)

The MCP tab will allow you to start a local WebSocket server that exposes MCP-compatible tools:

- `whatsapp.listChats()` - List all chats
- `whatsapp.openChat(name)` - Focus a specific chat
- `whatsapp.scrapeMessages(opts)` - Scrape message history
- `whatsapp.sendMessage(chat, text)` - Send messages

Connect from Claude Desktop, Cursor, or other MCP clients to control WhatsApp programmatically.

## Files

```
extensions/whatsapp-scraper/
├── manifest.json      # Extension config (MV3)
├── background.js      # Service worker (handles icon clicks)
├── content.js         # Injected script (panel UI + scraping logic)
├── panel.css          # Side panel styles
├── icon.svg           # Extension icon
└── README.md          # This file
```

## Notes

- WhatsApp Web DOM structure changes frequently. If scraping stops working, the selectors in `content.js` may need updating.
- For very long chats, increase the scroll limit (default: 500)
- The extension only reads messages in Scrape mode - it doesn't modify anything

## Troubleshooting

**Side panel doesn't open**
- Make sure you're on web.whatsapp.com
- Refresh the page after installing/updating the extension

**"No chat open"**
- Make sure you have a chat selected (not just the chat list)

**No messages found**
- Check your filter settings
- Try reducing minimum length to 0
- WhatsApp DOM might have changed - check console for errors
