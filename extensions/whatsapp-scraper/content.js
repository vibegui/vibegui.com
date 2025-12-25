/**
 * WhatsApp Web Message Scraper - Content Script
 *
 * This script runs in the WhatsApp Web tab and handles:
 * - Injecting and managing side panel UI
 * - Identifying message DOM elements
 * - Scrolling through chat history
 * - Extracting message content including photo captions
 */

// =============================================================================
// STATE
// =============================================================================

let isRunning = false;
let shouldStop = false;
let messages = [];
let options = {};
let status = "idle";
let scrollCount = 0;
let noNewContentCount = 0;
let retryWaitMs = 1500;
let customFileHandle = null;

// =============================================================================
// SELECTORS
// =============================================================================

const SELECTORS = {
  messageRow: "div[data-id]",
  messageOut: ".message-out",
  messageIn: ".message-in",
  selectableText: 'span[data-testid="selectable-text"]',
  copyableText: ".copyable-text[data-pre-plain-text]",
  imageWithAlt: "img[alt]",
  timestamp: '[data-testid="msg-meta"]',
  scrollContainers: [
    '[data-testid="conversation-panel-messages"]',
    '[role="application"]',
    "#main .copyable-area",
    "#main",
  ],
};

// =============================================================================
// PANEL UI
// =============================================================================

function createPanel() {
  if (document.getElementById("wa-scraper-panel")) return;

  const panel = document.createElement("div");
  panel.id = "wa-scraper-panel";
  panel.innerHTML = `
    <div class="wa-panel-header">
      <button class="wa-panel-tab active" data-tab="scrape">Scrape</button>
      <button class="wa-panel-tab" data-tab="mcp">MCP <span class="wa-badge">off</span></button>
      <button class="wa-panel-close" title="Close">&times;</button>
    </div>
    <div class="wa-panel-content">
      <!-- SCRAPE TAB -->
      <div class="wa-panel-view active" id="view-scrape">
        <div class="wa-status hidden" id="scrape-status">
          <span class="wa-status-text">Ready</span>
          <span class="wa-status-count">0 messages</span>
        </div>

        <div class="wa-field">
          <label>Filter Messages</label>
          <div class="wa-radio-group">
            <label class="wa-radio">
              <input type="radio" name="filter" value="all" checked>
              All messages
            </label>
            <label class="wa-radio">
              <input type="radio" name="filter" value="me">
              Only mine
            </label>
          </div>
        </div>

        <div class="wa-field">
          <label>Content Types</label>
          <label class="wa-checkbox">
            <input type="checkbox" id="include-text" checked>
            Include text messages
          </label>
          <label class="wa-checkbox">
            <input type="checkbox" id="include-media" checked>
            Include media captions
          </label>
        </div>

        <div class="wa-field">
          <label>Output Format</label>
          <label class="wa-checkbox">
            <input type="checkbox" id="only-urls">
            Only URLs (one per line)
          </label>
        </div>

        <div class="wa-field">
          <label>Minimum Length (chars)</label>
          <input type="number" id="min-length" value="0" min="0">
        </div>

        <div class="wa-field">
          <label>Scroll Limit</label>
          <input type="number" id="scroll-limit" value="500" min="1">
          <div class="hint">Max number of scroll actions (more = more history)</div>
        </div>

        <div class="wa-field">
          <label>Filename</label>
          <input type="text" id="filename" value="whatsapp-{chatName}-{date}.txt">
          <div class="hint">Use {chatName} and {date} as placeholders</div>
        </div>

        <label class="wa-checkbox">
          <input type="checkbox" id="use-default-download" checked>
          Use default download folder
        </label>

        <div class="wa-field" id="custom-path-group" style="display: none;">
          <button class="wa-btn wa-btn-secondary" id="btn-choose-path" style="width: 100%;">Choose save location...</button>
        </div>

        <div class="wa-btn-row">
          <button class="wa-btn wa-btn-primary" id="btn-start">Start Scraping</button>
          <button class="wa-btn wa-btn-secondary hidden" id="btn-stop">Stop</button>
        </div>

        <div class="wa-btn-row hidden" id="export-row">
          <button class="wa-btn wa-btn-secondary" id="btn-export">Export</button>
        </div>

        <div class="wa-btn-row" style="margin-top: 12px;">
          <button class="wa-btn wa-btn-secondary" id="btn-debug" style="font-size: 12px; padding: 8px;">🔍 Debug Selectors</button>
        </div>
        <pre id="debug-output" style="display: none; background: #1a1a1a; padding: 10px; border-radius: 8px; font-size: 11px; overflow: auto; max-height: 200px; margin-top: 10px; white-space: pre-wrap;"></pre>
      </div>

      <!-- MCP TAB -->
      <div class="wa-panel-view" id="view-mcp">
        <div class="wa-mcp-hero">
          <h2>🤖 WhatsApp MCP Bridge</h2>
          <p>Let AI agents control your WhatsApp through MCP tools. Run the vibegui.com MCP server locally.</p>

          <div class="wa-mcp-status disconnected" id="mcp-status">
            <span class="wa-mcp-dot"></span> Not connected
          </div>

          <div class="wa-mcp-instructions">
            <h3>🚀 How to Connect</h3>
            <ul>
              <li>1. Run <code>bun run mcp:dev</code> in vibegui.com</li>
              <li>2. Extension auto-connects to <code>ws://localhost:9999</code></li>
              <li>3. Status above will show "Connected"</li>
              <li>4. Use Cursor/Claude to call WhatsApp tools!</li>
            </ul>
          </div>

          <div class="wa-mcp-instructions">
            <h3>🔧 Available Tools</h3>
            <ul>
              <li><code>WHATSAPP_STATUS</code> - Check connection</li>
              <li><code>WHATSAPP_LIST_CHATS</code> - List sidebar chats</li>
              <li><code>WHATSAPP_SEARCH_CHATS</code> - Search by name</li>
              <li><code>WHATSAPP_OPEN_CHAT</code> - Open a chat</li>
              <li><code>WHATSAPP_READ_MESSAGES</code> - Read visible msgs</li>
              <li><code>WHATSAPP_SCROLL_UP</code> - Load older msgs</li>
              <li><code>WHATSAPP_SCRAPE</code> - Full history scrape</li>
            </ul>
          </div>

          <div class="wa-mcp-footer">
            <button class="wa-btn wa-btn-secondary" id="btn-mcp-reconnect">
              Reconnect
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(panel);
  initPanelEvents();
}

function initPanelEvents() {
  const panel = document.getElementById("wa-scraper-panel");
  if (!panel) return;

  // Tab switching
  panel.querySelectorAll(".wa-panel-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      panel
        .querySelectorAll(".wa-panel-tab")
        .forEach((t) => t.classList.remove("active"));
      panel
        .querySelectorAll(".wa-panel-view")
        .forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      const viewId = `view-${tab.dataset.tab}`;
      document.getElementById(viewId)?.classList.add("active");
    });
  });

  // Close button
  panel.querySelector(".wa-panel-close").addEventListener("click", () => {
    panel.classList.remove("open");
    document.body.classList.remove("wa-scraper-open");
  });

  // Use default download checkbox
  document
    .getElementById("use-default-download")
    .addEventListener("change", (e) => {
      const customGroup = document.getElementById("custom-path-group");
      customGroup.style.display = e.target.checked ? "none" : "block";
    });

  // Choose path button
  document
    .getElementById("btn-choose-path")
    .addEventListener("click", chooseCustomPath);

  // Start button
  document.getElementById("btn-start").addEventListener("click", startScraping);

  // Stop button
  document.getElementById("btn-stop").addEventListener("click", stopScraping);

  // Export button
  document
    .getElementById("btn-export")
    .addEventListener("click", exportMessages);

  // Debug button
  document.getElementById("btn-debug").addEventListener("click", runDebug);

  // MCP Reconnect button
  document
    .getElementById("btn-mcp-reconnect")
    ?.addEventListener("click", () => {
      debug("Manual MCP reconnect requested");
      if (mcpSocket) {
        mcpSocket.close();
      }
      mcpSocket = null;
      connectToMCP();
    });
}

function runDebug() {
  const output = document.getElementById("debug-output");
  if (!output) return;

  const container = getScrollContainer();
  const rows = document.querySelectorAll(SELECTORS.messageRow);
  const allMessages = getVisibleMessages();

  let text = `=== DEBUG INFO ===\n`;
  text += `Scroll container: ${container ? "FOUND" : "NOT FOUND"}\n`;
  text += `Message rows (div[data-id]): ${rows.length}\n`;
  text += `Extracted messages: ${allMessages.length}\n`;
  text += `With text: ${allMessages.filter((m) => m.text).length}\n`;
  text += `Outgoing: ${allMessages.filter((m) => m.isOutgoing).length}\n`;
  text += `Incoming: ${allMessages.filter((m) => !m.isOutgoing).length}\n\n`;

  text += `--- Selector counts ---\n`;
  text += `copyable-text: ${document.querySelectorAll(SELECTORS.copyableText).length}\n`;
  text += `selectable-text: ${document.querySelectorAll(SELECTORS.selectableText).length}\n`;
  text += `message-out: ${document.querySelectorAll(SELECTORS.messageOut).length}\n`;
  text += `message-in: ${document.querySelectorAll(SELECTORS.messageIn).length}\n\n`;

  if (allMessages.length > 0) {
    text += `--- Sample (first 2) ---\n`;
    allMessages.slice(0, 2).forEach((m, i) => {
      text += `${i + 1}. id: ${m.id?.slice(0, 30)}...\n`;
      text += `   out: ${m.isOutgoing}, text: "${m.text?.slice(0, 40)}..."\n`;
      text += `   ts: ${m.timestamp}, author: ${m.author}\n`;
    });
  } else {
    text += `--- No messages extracted! ---\n`;
    text += `Checking first div[data-id]:\n`;
    const firstRow = rows[0];
    if (firstRow) {
      text += `  data-id: ${firstRow.getAttribute("data-id")?.slice(0, 40)}...\n`;
      text += `  classes: ${firstRow.className}\n`;
      text += `  has .message-out: ${!!firstRow.querySelector(".message-out")}\n`;
      text += `  has .message-in: ${!!firstRow.querySelector(".message-in")}\n`;
      text += `  innerText: "${firstRow.innerText?.slice(0, 60)}..."\n`;
    }
  }

  output.textContent = text;
  output.style.display = "block";
  debug(text);
}

function togglePanel() {
  let panel = document.getElementById("wa-scraper-panel");
  if (!panel) {
    createPanel();
    panel = document.getElementById("wa-scraper-panel");
  }
  const isOpen = panel.classList.toggle("open");
  // Add/remove body class to push WhatsApp content
  document.body.classList.toggle("wa-scraper-open", isOpen);
}

function updateStatus(text, count) {
  const statusEl = document.getElementById("scrape-status");
  if (!statusEl) return;

  statusEl.classList.remove("hidden");
  statusEl.querySelector(".wa-status-text").textContent = text;
  statusEl.querySelector(".wa-status-count").textContent = `${count} messages`;

  if (isRunning) {
    statusEl.classList.add("running");
  } else {
    statusEl.classList.remove("running");
  }
}

// =============================================================================
// SCRAPING UI LOGIC
// =============================================================================

async function startScraping() {
  const filter =
    document.querySelector('input[name="filter"]:checked')?.value || "me";
  const includeText = document.getElementById("include-text")?.checked ?? true;
  const includeMedia =
    document.getElementById("include-media")?.checked ?? true;
  const minLength = parseInt(document.getElementById("min-length")?.value) || 0;
  const scrollLimit =
    parseInt(document.getElementById("scroll-limit")?.value) || 500;

  options = { filter, includeText, includeMedia, minLength, scrollLimit };
  messages = [];
  isRunning = true;
  shouldStop = false;
  noNewContentCount = 0;
  retryWaitMs = 1500;

  // Update UI
  document.getElementById("btn-start")?.classList.add("hidden");
  document.getElementById("btn-stop")?.classList.remove("hidden");
  document.getElementById("export-row")?.classList.add("hidden");

  updateStatus("Starting...", 0);

  // Start scraping
  await scrape();

  // Done
  document.getElementById("btn-start")?.classList.remove("hidden");
  document.getElementById("btn-stop")?.classList.add("hidden");
  if (messages.length > 0) {
    document.getElementById("export-row")?.classList.remove("hidden");
  }

  updateStatus(status, messages.length);

  // Auto-export if using default download
  if (
    document.getElementById("use-default-download")?.checked &&
    messages.length > 0
  ) {
    exportMessages();
  }
}

function stopScraping() {
  shouldStop = true;
  updateStatus("Stopping...", messages.length);
}

function getChatName() {
  const selectors = [
    'header span[dir="auto"][title]',
    "header span[title]",
    '#main header span[dir="auto"]',
    '[data-testid="conversation-header"] span',
  ];

  // Words that indicate "last seen" status - not the chat name
  const statusWords = [
    "visto",
    "online",
    "last seen",
    "typing",
    "digitando",
    "gravando",
    "clique aqui",
  ];

  for (const sel of selectors) {
    const elements = document.querySelectorAll(sel);
    for (const el of elements) {
      const name = el.getAttribute("title") || el.innerText;
      if (name && name.length > 0 && name.length < 100) {
        const lower = name.toLowerCase();
        // Skip if this looks like a status message
        if (statusWords.some((w) => lower.includes(w))) {
          continue;
        }
        return name.trim();
      }
    }
  }
  return "unknown-chat";
}

async function chooseCustomPath() {
  const filenameTemplate =
    document.getElementById("filename")?.value ||
    "whatsapp-{chatName}-{date}.txt";
  const suggestedName = processFilename(filenameTemplate);

  try {
    customFileHandle = await window.showSaveFilePicker({
      suggestedName,
      startIn: "downloads",
      types: [
        { description: "Text files", accept: { "text/plain": [".txt"] } },
      ],
    });

    const btn = document.getElementById("btn-choose-path");
    if (btn) {
      btn.textContent = `📁 ${customFileHandle.name}`;
    }
    debug("Custom path selected:", customFileHandle.name);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Failed to choose path:", err);
    }
  }
}

function processFilename(template) {
  const chatName = getChatName()
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 50);

  const now = new Date();
  const date = now.toISOString().split("T")[0]; // YYYY-MM-DD

  return template.replace("{chatName}", chatName).replace("{date}", date);
}

/**
 * Extract all URLs from a text string
 */
function extractUrls(text) {
  if (!text) return [];
  // Match URLs with or without protocol
  const urlRegex = /(?:https?:\/\/|www\.)[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  // Clean up trailing punctuation that might be captured
  return matches.map((url) =>
    url.replace(/[.,;:!?)]+$/, "").replace(/\)+$/, ""),
  );
}

function formatMessage(msg) {
  // Format: [DD/MM/YYYY, HH:MM:SS] Author: Message
  let timestamp = msg.timestamp || "";

  // Convert from "HH:MM, DD/MM/YYYY" to "DD/MM/YYYY, HH:MM:SS"
  const match = timestamp.match(
    /(\d{2}):(\d{2}),?\s*(\d{2})\/(\d{2})\/(\d{4})/,
  );
  if (match) {
    const [, hour, min, day, month, year] = match;
    timestamp = `${day}/${month}/${year}, ${hour}:${min}:00`;
  }

  // Replace newlines with spaces to keep one message per line
  const text = (msg.text || "").replace(/\n+/g, " ").trim();

  const filter = options.filter || "all";
  if (filter === "me") {
    return `[${timestamp}] ${text}`;
  } else {
    const author = msg.author || (msg.isOutgoing ? "Me" : "Unknown");
    return `[${timestamp}] ${author}: ${text}`;
  }
}

function exportMessages() {
  if (messages.length === 0) {
    debug("No messages to export");
    return;
  }

  const onlyUrls = document.getElementById("only-urls")?.checked ?? false;
  let content;

  if (onlyUrls) {
    // Extract all URLs and deduplicate
    const allUrls = new Set();
    for (const msg of messages) {
      const urls = extractUrls(msg.text);
      for (const url of urls) {
        allUrls.add(url);
      }
    }
    content = Array.from(allUrls).join("\n");
    debug(
      `Extracted ${allUrls.size} unique URLs from ${messages.length} messages`,
    );
  } else {
    content = messages.map(formatMessage).join("\n");
  }

  const filenameTemplate =
    document.getElementById("filename")?.value ||
    "whatsapp-{chatName}-{date}.txt";
  const filename = processFilename(filenameTemplate);

  const useDefault =
    document.getElementById("use-default-download")?.checked ?? true;

  if (useDefault) {
    // Auto-download to browser's default folder
    downloadViaBlob(content, filename);
  } else if (customFileHandle) {
    // Use pre-selected file handle
    saveWithHandle(content, customFileHandle);
  } else {
    // No handle selected, prompt for one
    saveWithPicker(content, filename);
  }
}

async function saveWithHandle(content, handle) {
  try {
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    debug(`Saved to: ${handle.name} (${messages.length} messages)`);
    updateStatus("Exported!", messages.length);
  } catch (err) {
    console.error("Save failed:", err);
    // Fallback to download
    downloadViaBlob(content, handle.name || "whatsapp-export.txt");
  }
}

function downloadViaBlob(content, filename) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  const onlyUrls = document.getElementById("only-urls")?.checked ?? false;
  const lineCount = content.split("\n").filter((l) => l.trim()).length;
  const label = onlyUrls ? `${lineCount} URLs` : `${messages.length} messages`;
  debug(`Downloaded: ${filename} (${label})`);
  updateStatus("Exported!", messages.length);
}

async function saveWithPicker(content, suggestedName) {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      startIn: "downloads",
      types: [
        { description: "Text files", accept: { "text/plain": [".txt"] } },
      ],
    });

    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();

    debug(`Saved: ${suggestedName} (${messages.length} messages)`);
    updateStatus("Exported!", messages.length);
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Save failed:", err);
      // Fallback to download
      downloadViaBlob(content, suggestedName);
    }
  }
}

// =============================================================================
// SCRAPING ENGINE
// =============================================================================

function getScrollContainer() {
  for (const sel of SELECTORS.scrollContainers) {
    const el = document.querySelector(sel);
    if (el) {
      const scrollable = findScrollableChild(el);
      if (scrollable) return scrollable;
    }
  }
  return null;
}

function findScrollableChild(el) {
  if (el.scrollHeight > el.clientHeight + 50) {
    return el;
  }
  for (const child of el.children) {
    const scrollable = findScrollableChild(child);
    if (scrollable) return scrollable;
  }
  return null;
}

function extractTextContent(el) {
  let text = "";

  // First, click "Read more" / "Ler mais" if present to expand truncated messages
  const readMoreBtn = el.querySelector('span[role="button"]');
  if (readMoreBtn) {
    const btnText = readMoreBtn.innerText?.toLowerCase() || "";
    if (
      btnText.includes("ler mais") ||
      btnText.includes("read more") ||
      btnText.includes("...")
    ) {
      readMoreBtn.click();
    }
  }

  // Method 1: Get from selectable-text span - use innerText directly to capture everything
  const selectableSpan = el.querySelector(SELECTORS.selectableText);
  if (selectableSpan) {
    text = selectableSpan.innerText || "";
  }

  // Method 2: Try copyable-text container
  if (!text) {
    const copyable = el.querySelector(SELECTORS.copyableText);
    if (copyable) {
      // Get text from the selectable span inside copyable
      const inner = copyable.querySelector(SELECTORS.selectableText);
      if (inner) {
        text = inner.innerText || "";
      }
    }
  }

  // Method 3: Image alt text (for captions)
  if (!text) {
    const img = el.querySelector(SELECTORS.imageWithAlt);
    if (img && img.alt && img.alt.length > 10) {
      text = img.alt;
    }
  }

  // Clean up: normalize multiple newlines to single, trim whitespace
  text = text
    .replace(/\n{3,}/g, "\n\n") // Max 2 consecutive newlines
    .replace(/[ \t]+/g, " ") // Collapse multiple spaces
    .trim();

  return text.trim();
}

function extractMessage(el) {
  const dataId = el.getAttribute("data-id");
  if (!dataId) return null;

  const isOutgoing =
    el.classList.contains("message-out") ||
    el.querySelector(SELECTORS.messageOut) !== null ||
    dataId.includes("true_");

  const isIncoming =
    el.classList.contains("message-in") ||
    el.querySelector(SELECTORS.messageIn) !== null ||
    dataId.includes("false_");

  if (!isOutgoing && !isIncoming) return null;

  const text = extractTextContent(el);

  let timestamp = "";
  let author = "";
  const copyableDiv = el.querySelector(SELECTORS.copyableText);
  if (copyableDiv) {
    const prePlainText = copyableDiv.getAttribute("data-pre-plain-text");
    if (prePlainText) {
      const tsMatch = prePlainText.match(/\[([^\]]+)\]/);
      if (tsMatch) timestamp = tsMatch[1];

      const authorMatch = prePlainText.match(/\]\s*([^:]+):/);
      if (authorMatch) author = authorMatch[1].trim();
    }
  }

  const hasMedia = el.querySelector("img, video") !== null;

  return { id: dataId, text, isOutgoing, timestamp, author, hasMedia };
}

function getVisibleMessages() {
  const rows = document.querySelectorAll(SELECTORS.messageRow);
  const results = [];
  for (const row of rows) {
    const msg = extractMessage(row);
    if (msg) results.push(msg);
  }
  return results;
}

function filterMessage(msg) {
  if (!msg.text || msg.text.length === 0) return false;
  if (options.filter === "me" && !msg.isOutgoing) return false;
  if (!options.includeText && !msg.hasMedia) return false;
  if (!options.includeMedia && msg.hasMedia && !msg.text) return false;
  if (options.minLength > 0 && msg.text.length < options.minLength)
    return false;
  return true;
}

function mergeMessages(newMsgs) {
  const existingIds = new Set(messages.map((m) => m.id));
  let addedCount = 0;

  for (const msg of newMsgs) {
    if (!existingIds.has(msg.id) && filterMessage(msg)) {
      messages.push(msg);
      existingIds.add(msg.id);
      addedCount++;
    }
  }

  return addedCount;
}

function clickLoadMoreNotice() {
  const buttons = document.querySelectorAll("button");
  for (const btn of buttons) {
    const text = btn.innerText.toLowerCase();
    if (
      text.includes("carregar mensagens") ||
      text.includes("load older") ||
      text.includes("load messages")
    ) {
      debug("Clicking 'load older messages' notice");
      btn.click();
      return true;
    }
  }
  return false;
}

async function scrollUp(container) {
  const prevScrollHeight = container.scrollHeight;
  const prevMessageCount = document.querySelectorAll(
    SELECTORS.messageRow,
  ).length;

  clickLoadMoreNotice();
  container.scrollTop = 0;
  await new Promise((r) => setTimeout(r, 1200));
  clickLoadMoreNotice();

  const newScrollHeight = container.scrollHeight;
  const newMessageCount = document.querySelectorAll(
    SELECTORS.messageRow,
  ).length;

  return (
    newScrollHeight > prevScrollHeight || newMessageCount > prevMessageCount
  );
}

async function scrape() {
  debug("Starting scrape with options:", options);

  const container = getScrollContainer();
  debug("Scroll container:", container ? "found" : "NOT FOUND");

  if (!container) {
    status = "error: no chat open";
    isRunning = false;
    updateStatus("Error: No chat open", 0);
    return;
  }

  // Debug: check selectors
  const rowCount = document.querySelectorAll(SELECTORS.messageRow).length;
  debug("Message rows found (div[data-id]):", rowCount);

  status = "starting...";
  scrollCount = 0;
  noNewContentCount = 0;

  const initial = getVisibleMessages();
  debug("Initial visible messages:", initial.length);
  debug("Sample (first 2):", initial.slice(0, 2));

  // Debug: show filter breakdown
  const outgoing = initial.filter((m) => m.isOutgoing);
  const withText = initial.filter((m) => m.text && m.text.length > 0);
  const outgoingWithText = initial.filter(
    (m) => m.isOutgoing && m.text && m.text.length > 0,
  );
  debug(
    "Breakdown - outgoing:",
    outgoing.length,
    "withText:",
    withText.length,
    "outgoing+text:",
    outgoingWithText.length,
  );
  if (outgoingWithText.length > 0) {
    debug("Sample outgoing with text:", outgoingWithText[0]);
  }
  if (outgoing.length > 0 && outgoingWithText.length === 0) {
    debug("Outgoing but NO text:", outgoing[0]);
  }

  const initialAdded = mergeMessages(initial);
  debug("After filter, added:", initialAdded, "total:", messages.length);
  debug("Filter options:", options);
  updateStatus("Scrolling...", messages.length);

  while (isRunning && !shouldStop && scrollCount < options.scrollLimit) {
    status = `scrolling ${scrollCount + 1}/${options.scrollLimit}...`;

    const hasMore = await scrollUp(container);
    const visible = getVisibleMessages();
    const added = mergeMessages(visible);

    scrollCount++;

    if (scrollCount % 5 === 0) {
      updateStatus(
        `Scrolling ${scrollCount}/${options.scrollLimit}`,
        messages.length,
      );
    }

    if (!hasMore && added === 0) {
      noNewContentCount++;
      const maxRetries = 6;
      const waitTime = Math.min(
        retryWaitMs * Math.pow(1.5, noNewContentCount - 1),
        15000,
      );
      debug(
        `No new content (${noNewContentCount}/${maxRetries}), waiting ${Math.round(waitTime / 1000)}s...`,
      );

      if (noNewContentCount >= maxRetries) {
        status = "reached top of chat";
        debug("Stopping: reached top of chat after retries");
        break;
      }

      await new Promise((r) => setTimeout(r, waitTime));
    } else {
      noNewContentCount = 0;
      retryWaitMs = 1500;
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  const final = getVisibleMessages();
  mergeMessages(final);

  // Sort by timestamp (oldest first)
  messages.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;
    const parseTs = (ts) => {
      const match = ts.match(/(\d{2}):(\d{2}),?\s*(\d{2})\/(\d{2})\/(\d{4})/);
      if (!match) return 0;
      const [, hour, min, day, month, year] = match;
      return new Date(year, month - 1, day, hour, min).getTime();
    };
    return parseTs(a.timestamp) - parseTs(b.timestamp);
  });

  debug("Scrape complete. Total messages:", messages.length);
  isRunning = false;
  status = shouldStop ? "stopped" : "done";
  updateStatus(status === "done" ? "Complete!" : "Stopped", messages.length);
}

// =============================================================================
// MESSAGE HANDLING
// =============================================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "togglePanel") {
    togglePanel();
    sendResponse({ success: true });
  }
  return true;
});

// =============================================================================
// MCP BRIDGE - WebSocket connection to local MCP server
// =============================================================================

let mcpSocket = null;
let mcpReconnectInterval = null;
let mcpConnected = false;

/**
 * Connect to the MCP server's WebSocket
 */
function connectToMCP() {
  if (mcpSocket?.readyState === WebSocket.OPEN) return;

  try {
    mcpSocket = new WebSocket("ws://localhost:9999");

    mcpSocket.onopen = () => {
      debug("MCP Bridge connected to ws://localhost:9999");
      mcpConnected = true;
      updateMCPStatus("connected");
      if (mcpReconnectInterval) {
        clearInterval(mcpReconnectInterval);
        mcpReconnectInterval = null;
      }
    };

    mcpSocket.onmessage = async (event) => {
      try {
        const request = JSON.parse(event.data);
        debug("MCP Request:", request.method, request.params);

        try {
          const result = await handleMCPCommand(
            request.method,
            request.params || {},
          );
          mcpSocket.send(JSON.stringify({ id: request.id, result }));
          debug("MCP Response sent for:", request.method);
        } catch (error) {
          debug("MCP Command error:", error.message);
          mcpSocket.send(
            JSON.stringify({
              id: request.id,
              error: { code: -1, message: error.message },
            }),
          );
        }
      } catch (parseError) {
        debug("Failed to parse MCP message:", parseError);
      }
    };

    mcpSocket.onclose = () => {
      debug("MCP Bridge disconnected");
      mcpConnected = false;
      mcpSocket = null;
      updateMCPStatus("disconnected");
      // Auto-reconnect every 5 seconds
      if (!mcpReconnectInterval) {
        mcpReconnectInterval = setInterval(connectToMCP, 5000);
      }
    };

    mcpSocket.onerror = (err) => {
      debug("MCP Bridge error:", err);
    };
  } catch (err) {
    debug("Failed to connect to MCP:", err);
  }
}

/**
 * Handle incoming MCP commands
 */
async function handleMCPCommand(method, params) {
  switch (method) {
    case "status":
      return mcpStatus();

    case "listChats":
      return listChats(params.limit);

    case "searchChats":
      return searchChats(params.query);

    case "clearSearch":
      return clearSearch();

    case "openChat":
      return openChat(params.name);

    case "getCurrentChat":
      return { name: getChatName(), isGroup: isGroupChat() };

    case "readMessages":
      return readVisibleMessages(params.filter);

    case "scrollUp":
      return scrollUpMessages(params.count);

    case "scrollDown":
      return scrollDownMessages(params.count);

    case "scrape":
      return scrapeWithOptions(params);

    default:
      throw new Error(`Unknown MCP method: ${method}`);
  }
}

/**
 * MCP Command: Get status
 */
function mcpStatus() {
  const container = getScrollContainer();
  return {
    connected: true,
    chatOpen: !!container,
    currentChat: container ? getChatName() : undefined,
  };
}

/**
 * MCP Command: List chats in sidebar
 */
function listChats(limit = 50) {
  // Try multiple selectors for chat items
  const chatSelectors = [
    '[data-testid="cell-frame-container"]',
    '[data-testid="list-item-chat"]',
    'div[role="listitem"]',
    "#pane-side > div > div > div > div",
  ];

  let chatItems = [];
  for (const sel of chatSelectors) {
    chatItems = document.querySelectorAll(sel);
    if (chatItems.length > 0) break;
  }

  const chats = [];
  for (const item of Array.from(chatItems).slice(0, limit)) {
    // Try to get chat name
    const nameEl =
      item.querySelector('span[dir="auto"][title]') ||
      item.querySelector("span[title]") ||
      item.querySelector('span[dir="auto"]');

    const name = nameEl?.getAttribute("title") || nameEl?.innerText;
    if (!name || name.length === 0) continue;

    // Skip status-like text
    const lower = name.toLowerCase();
    if (
      lower.includes("last seen") ||
      lower.includes("visto por") ||
      lower.includes("online") ||
      lower.includes("typing")
    ) {
      continue;
    }

    // Get last message preview
    const msgEl =
      item.querySelector('span[dir="ltr"]') ||
      item.querySelector('span[class*="last"]');
    const lastMessage = msgEl?.innerText;

    // Get time
    const timeEl =
      item.querySelector('[data-testid="last-msg-time"]') ||
      item.querySelector("span:last-child");
    const time = timeEl?.innerText;

    // Get unread count if present
    const unreadEl =
      item.querySelector('[data-testid="unread-count"]') ||
      item.querySelector('span[aria-label*="unread"]');
    const unread = unreadEl ? parseInt(unreadEl.innerText) || 0 : 0;

    chats.push({ name, lastMessage, time, unread });
  }

  return { chats, total: chats.length };
}

/**
 * MCP Command: Search chats
 */
function searchChats(query) {
  // Find search input
  const searchSelectors = [
    '[data-testid="chat-list-search"]',
    'div[contenteditable="true"][data-tab="3"]',
    '[role="textbox"][title*="Search"]',
    '[role="textbox"][title*="Pesquisar"]',
  ];

  let searchBox = null;
  for (const sel of searchSelectors) {
    searchBox = document.querySelector(sel);
    if (searchBox) break;
  }

  if (!searchBox) {
    // Try clicking the search button first
    const searchBtn = document.querySelector(
      '[data-testid="chat-list-search-container"]',
    );
    if (searchBtn) searchBtn.click();

    // Wait a bit and try again
    return new Promise((resolve) => {
      setTimeout(() => {
        for (const sel of searchSelectors) {
          searchBox = document.querySelector(sel);
          if (searchBox) break;
        }
        if (searchBox) {
          performSearch(searchBox, query);
          resolve({ success: true });
        } else {
          resolve({ success: false, error: "Search box not found" });
        }
      }, 300);
    });
  }

  performSearch(searchBox, query);
  return { success: true };
}

function performSearch(searchBox, query) {
  searchBox.focus();
  // Clear existing content
  searchBox.innerHTML = "";
  // Type the query
  document.execCommand("insertText", false, query);
  // Trigger input event
  searchBox.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * MCP Command: Clear search
 */
function clearSearch() {
  const clearBtn =
    document.querySelector('[data-testid="search-clear-btn"]') ||
    document.querySelector('button[aria-label*="Clear"]') ||
    document.querySelector('button[aria-label*="Limpar"]');

  if (clearBtn) {
    clearBtn.click();
    return { success: true };
  }

  // Try pressing Escape
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "Escape", keyCode: 27 }),
  );
  return { success: true };
}

/**
 * MCP Command: Open a chat by name
 */
function openChat(name) {
  const chatSelectors = [
    '[data-testid="cell-frame-container"]',
    '[data-testid="list-item-chat"]',
    'div[role="listitem"]',
  ];

  let chatItems = [];
  for (const sel of chatSelectors) {
    chatItems = document.querySelectorAll(sel);
    if (chatItems.length > 0) break;
  }

  const nameLower = name.toLowerCase();

  for (const item of chatItems) {
    const nameEl =
      item.querySelector('span[dir="auto"][title]') ||
      item.querySelector("span[title]") ||
      item.querySelector('span[dir="auto"]');

    const chatName = nameEl?.getAttribute("title") || nameEl?.innerText;
    if (chatName?.toLowerCase().includes(nameLower)) {
      item.click();
      return { success: true, openedChat: chatName };
    }
  }

  throw new Error(
    `Chat not found: "${name}". Try using WHATSAPP_LIST_CHATS to see available chats.`,
  );
}

/**
 * Check if current chat is a group
 */
function isGroupChat() {
  // Groups typically have participant counts or specific icons
  const groupIndicators = [
    '[data-testid="group-subject"]',
    'span[title*="participants"]',
    'span[title*="participantes"]',
  ];

  for (const sel of groupIndicators) {
    if (document.querySelector(sel)) return true;
  }
  return false;
}

/**
 * MCP Command: Read visible messages
 */
function readVisibleMessages(filter = "all") {
  const msgs = getVisibleMessages();
  let filtered = msgs;

  if (filter === "me") {
    filtered = msgs.filter((m) => m.isOutgoing);
  } else if (filter === "them") {
    filtered = msgs.filter((m) => !m.isOutgoing);
  }

  return {
    messages: filtered,
    total: filtered.length,
    chatName: getChatName(),
  };
}

/**
 * MCP Command: Scroll up to load older messages
 */
async function scrollUpMessages(count = 1) {
  const container = getScrollContainer();
  if (!container)
    throw new Error("No chat open. Use WHATSAPP_OPEN_CHAT first.");

  let scrolledCount = 0;
  let reachedTop = false;

  for (let i = 0; i < count; i++) {
    const prevHeight = container.scrollHeight;
    const hadMore = await scrollUp(container);

    if (hadMore) {
      scrolledCount++;
    } else {
      // Check if we're at the top
      if (container.scrollTop === 0 && container.scrollHeight === prevHeight) {
        reachedTop = true;
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 300));
  }

  return { scrolled: scrolledCount, reachedTop };
}

/**
 * MCP Command: Scroll down to see newer messages
 */
async function scrollDownMessages(count = 1) {
  const container = getScrollContainer();
  if (!container)
    throw new Error("No chat open. Use WHATSAPP_OPEN_CHAT first.");

  let scrolledCount = 0;

  for (let i = 0; i < count; i++) {
    container.scrollTop += container.clientHeight * 0.8;
    scrolledCount++;
    await new Promise((r) => setTimeout(r, 200));
  }

  return { scrolled: scrolledCount };
}

/**
 * MCP Command: Full scrape with auto-scroll
 */
async function scrapeWithOptions(opts) {
  const container = getScrollContainer();
  if (!container)
    throw new Error("No chat open. Use WHATSAPP_OPEN_CHAT first.");

  // Store original options and state
  const originalOptions = { ...options };
  const originalMessages = [...messages];
  const originalIsRunning = isRunning;

  // Set up for MCP-controlled scrape
  options = {
    filter: opts.filter || "all",
    includeText: true,
    includeMedia: true,
    minLength: opts.minLength || 0,
    scrollLimit: opts.scrollLimit || 50,
  };
  messages = [];
  isRunning = true;
  shouldStop = false;
  noNewContentCount = 0;
  retryWaitMs = 1500;
  scrollCount = 0;

  // Run the scrape
  await scrape();

  const result = {
    messages: messages.map((m) => ({
      id: m.id,
      text: m.text,
      isOutgoing: m.isOutgoing,
      timestamp: m.timestamp,
      author: m.author,
      hasMedia: m.hasMedia,
    })),
    total: messages.length,
    scrollsPerformed: scrollCount,
  };

  // Restore original state
  options = originalOptions;
  messages = originalMessages;
  isRunning = originalIsRunning;

  return result;
}

/**
 * Update MCP status indicator in the panel
 */
function updateMCPStatus(status) {
  const statusEl = document.getElementById("mcp-status");
  if (statusEl) {
    if (status === "connected") {
      statusEl.className = "wa-mcp-status connected";
      statusEl.innerHTML =
        '<span class="wa-mcp-dot"></span> Connected to MCP Server';
    } else {
      statusEl.className = "wa-mcp-status disconnected";
      statusEl.innerHTML = '<span class="wa-mcp-dot"></span> Not connected';
    }
  }

  // Update the badge on MCP tab
  const badge = document.querySelector(
    '.wa-panel-tab[data-tab="mcp"] .wa-badge',
  );
  if (badge) {
    if (status === "connected") {
      badge.textContent = "live";
      badge.classList.add("live");
    } else {
      badge.textContent = "off";
      badge.classList.remove("live");
    }
  }
}

// =============================================================================
// INIT
// =============================================================================

function debug(...args) {
  console.log("[WA MCP]", ...args);
}

debug("Content script loaded v0.6 - MCP Bridge");

// Pre-create panel (hidden)
setTimeout(() => {
  createPanel();
  debug("Panel created");
}, 1000);

// Connect to MCP server after a short delay
setTimeout(() => {
  debug("Attempting to connect to MCP server...");
  connectToMCP();
}, 2000);

// Expose debug helper to console
window.__waScraperDebug = () => {
  const container = getScrollContainer();
  const rows = document.querySelectorAll(SELECTORS.messageRow);
  const allMessages = getVisibleMessages();

  debug("=== DEBUG INFO ===");
  debug("Scroll container:", container ? "FOUND" : "NOT FOUND");
  debug("Message rows (div[data-id]):", rows.length);
  debug("Extracted messages:", allMessages.length);
  debug("Messages with text:", allMessages.filter((m) => m.text).length);
  debug("Outgoing messages:", allMessages.filter((m) => m.isOutgoing).length);
  debug("Sample messages:", allMessages.slice(0, 3));
  debug("MCP connected:", mcpConnected);

  // Test individual selectors
  debug("--- Selector tests ---");
  debug(
    "copyable-text divs:",
    document.querySelectorAll(SELECTORS.copyableText).length,
  );
  debug(
    "selectable-text spans:",
    document.querySelectorAll(SELECTORS.selectableText).length,
  );
  debug("message-out:", document.querySelectorAll(SELECTORS.messageOut).length);
  debug("message-in:", document.querySelectorAll(SELECTORS.messageIn).length);

  return {
    container: !!container,
    rows: rows.length,
    messages: allMessages,
    options: options,
    mcpConnected,
  };
};

// Expose MCP control to console for testing
window.__waMcpConnect = connectToMCP;
window.__waMcpStatus = () => ({
  connected: mcpConnected,
  socket: mcpSocket?.readyState,
});
