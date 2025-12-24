# WhatsApp Web Message Scraper

A lightweight Chrome extension to extract messages from WhatsApp Web conversations.

## Features

- **Filter by sender**: All messages, only from me, or only from others
- **Content filters**: Text messages, media captions
- **Minimum length**: Skip short messages
- **Auto-scroll**: Automatically scrolls up to load older messages
- **Export to file**: Save extracted messages to a text file

## Installation

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `extensions/whatsapp-scraper` folder

## Usage

1. Open [WhatsApp Web](https://web.whatsapp.com)
2. Open the chat you want to scrape
3. Click the extension icon in Chrome toolbar
4. Configure filters:
   - **Filter messages**: All / Only from me / Only from others
   - **Content filter**: Text messages / Media captions
   - **Minimum length**: Skip messages shorter than N characters
   - **Scroll limit**: How many times to scroll up (more = older messages)
5. Click **Start Scraping**
6. Wait for completion (watch progress in status bar)
7. Click **Export** to save to a file

## Notes

- WhatsApp Web DOM structure changes frequently. If scraping stops working, the selectors in `content.js` may need updating.
- For very long chats, increase the scroll limit (default: 50)
- The extension only reads messages - it doesn't modify anything in WhatsApp

## Future Plans

- Agentic access to WhatsApp (send messages, react, etc.)
- Better media handling (extract image URLs)
- Export to JSON format
- Search/filter within scraped messages
- Background scraping (don't need to keep popup open)

## Troubleshooting

**"Extension not loaded. Refresh WhatsApp Web."**
- Refresh the WhatsApp Web tab after installing/updating the extension

**"No chat open"**
- Make sure you have a chat selected (not just the chat list)

**No messages found**
- Check your filter settings
- Try reducing minimum length to 0
- WhatsApp DOM might have changed - check console for errors

