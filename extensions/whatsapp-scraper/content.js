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
      <button class="wa-panel-tab" data-tab="mcp">MCP <span class="wa-badge">soon</span></button>
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
          <h2>🤖 WhatsApp MCP</h2>
          <p>Create an MCP server that exposes tools for AI agents to interact with your WhatsApp.</p>

          <button class="wa-mcp-btn" id="btn-mcp-start" disabled>
            <span>▶</span> Start MCP Server
          </button>

          <div class="wa-mcp-instructions">
            <h3>📋 Implementation Plan</h3>
            <ul>
              <li>1. Start a local WebSocket server on <code>localhost:9999</code></li>
              <li>2. Expose MCP-compatible JSON-RPC endpoints</li>
              <li>3. Tool: <code>whatsapp.listChats()</code> - List all chats</li>
              <li>4. Tool: <code>whatsapp.openChat(name)</code> - Focus a chat</li>
              <li>5. Tool: <code>whatsapp.scrapeMessages(opts)</code> - Scrape history</li>
              <li>6. Tool: <code>whatsapp.sendMessage(chat, text)</code> - Send messages</li>
              <li>7. Connect from Claude Desktop, Cursor, or other MCP clients</li>
            </ul>
          </div>

          <div class="wa-mcp-status stopped" id="mcp-status">
            Server not running
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

  const content = messages.map(formatMessage).join("\n");
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

  debug(`Downloaded: ${filename} (${messages.length} messages)`);
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
// INIT
// =============================================================================

function debug(...args) {
  console.log("[WA MCP]", ...args);
}

debug("Content script loaded v0.5 - side panel");

// Pre-create panel (hidden)
setTimeout(() => {
  createPanel();
  debug("Panel created");
}, 1000);

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
  };
};
