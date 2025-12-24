/**
 * WhatsApp Web Message Scraper - Content Script
 *
 * This script runs in the WhatsApp Web tab and handles:
 * - Identifying message DOM elements
 * - Scrolling through chat history
 * - Extracting message content including photo captions
 */

// State
let isRunning = false;
let shouldStop = false;
let messages = [];
let options = {};
let status = "idle";
let scrollCount = 0;
let noNewContentCount = 0;

// WhatsApp DOM selectors (updated Dec 2024)
const SELECTORS = {
  // Individual message row - has data-id attribute
  messageRow: "div[data-id]",
  // Outgoing message (from me)
  messageOut: ".message-out",
  // Incoming message (from others)
  messageIn: ".message-in",
  // Text content - the main text selector
  selectableText: 'span[data-testid="selectable-text"]',
  // Copyable text container with timestamp
  copyableText: ".copyable-text[data-pre-plain-text]",
  // Image with caption (caption in alt attribute)
  imageWithAlt: "img[alt]",
  // Message timestamp
  timestamp: '[data-testid="msg-meta"]',
  // Scroll container candidates
  scrollContainers: [
    '[data-testid="conversation-panel-messages"]',
    '[role="application"]',
    "#main .copyable-area",
    "#main",
  ],
};

// Get the messages scroll container
function getScrollContainer() {
  for (const sel of SELECTORS.scrollContainers) {
    const el = document.querySelector(sel);
    if (el) {
      // Find the actual scrollable child
      const scrollable = findScrollableChild(el);
      if (scrollable) return scrollable;
    }
  }
  return null;
}

// Find scrollable element within container
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

// Extract text from a message element
function extractTextContent(el) {
  let text = "";

  // Method 1: Get from selectable-text span (best for captions and regular messages)
  const selectableSpan = el.querySelector(SELECTORS.selectableText);
  if (selectableSpan) {
    // Get all text spans within
    const textSpans = selectableSpan.querySelectorAll(
      "span.x1lliihq, span:not([class])",
    );
    if (textSpans.length > 0) {
      text = Array.from(textSpans)
        .map((s) => s.innerText)
        .join("");
    } else {
      text = selectableSpan.innerText;
    }
  }

  // Method 2: If no text yet, try image alt attribute (captions are stored there too)
  if (!text) {
    const img = el.querySelector(SELECTORS.imageWithAlt);
    if (img && img.alt && img.alt.length > 10) {
      text = img.alt;
    }
  }

  // Method 3: Try copyable-text container
  if (!text) {
    const copyable = el.querySelector(SELECTORS.copyableText);
    if (copyable) {
      const inner = copyable.querySelector("span");
      if (inner) {
        text = inner.innerText;
      }
    }
  }

  return text.trim();
}

// Extract message data from a DOM element
function extractMessage(el) {
  const dataId = el.getAttribute("data-id");
  if (!dataId) return null;

  // Determine direction
  const isOutgoing =
    el.classList.contains("message-out") ||
    el.querySelector(SELECTORS.messageOut) !== null ||
    dataId.includes("true_"); // WhatsApp uses "true_" prefix for outgoing

  const isIncoming =
    el.classList.contains("message-in") ||
    el.querySelector(SELECTORS.messageIn) !== null ||
    dataId.includes("false_"); // WhatsApp uses "false_" prefix for incoming

  if (!isOutgoing && !isIncoming) return null;

  // Get text content
  const text = extractTextContent(el);

  // Get timestamp
  let timestamp = "";
  const copyableDiv = el.querySelector(SELECTORS.copyableText);
  if (copyableDiv) {
    const prePlainText = copyableDiv.getAttribute("data-pre-plain-text");
    if (prePlainText) {
      // Format: "[HH:MM, DD/MM/YYYY] Name: "
      const match = prePlainText.match(/\[([^\]]+)\]/);
      if (match) timestamp = match[1];
    }
  }

  // Check if has media
  const hasMedia = el.querySelector("img, video") !== null;

  return {
    id: dataId,
    text,
    isOutgoing,
    timestamp,
    hasMedia,
  };
}

// Get all visible messages
function getVisibleMessages() {
  const rows = document.querySelectorAll(SELECTORS.messageRow);
  const results = [];

  for (const row of rows) {
    const msg = extractMessage(row);
    if (msg) {
      results.push(msg);
    }
  }

  return results;
}

// Filter messages based on options
function filterMessage(msg) {
  // Must have text content
  if (!msg.text || msg.text.length === 0) return false;

  // Filter by sender
  if (options.filter === "me" && !msg.isOutgoing) return false;
  if (options.filter === "others" && msg.isOutgoing) return false;

  // Filter by content type
  if (!options.includeText && !msg.hasMedia) return false;
  if (!options.includeMedia && msg.hasMedia && !msg.text) return false;

  // Filter by length
  if (options.minLength > 0 && msg.text.length < options.minLength)
    return false;

  return true;
}

// Merge new messages avoiding duplicates
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

// Click "load older messages" notice if present
function clickLoadMoreNotice() {
  // Look for the notice button (Portuguese: "Clique neste aviso para carregar mensagens mais antigas")
  const noticeSelectors = [
    'button[class*="x1bvqhpb"]', // Generic button class from the notice
    'div[role="button"]:has(div:contains("carregar mensagens"))',
  ];

  // Find any button that contains text about loading older messages
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

// Scroll up to load more messages
async function scrollUp(container) {
  const prevScrollHeight = container.scrollHeight;
  const prevMessageCount = document.querySelectorAll(
    SELECTORS.messageRow,
  ).length;

  // Click "load more" notice if present
  clickLoadMoreNotice();

  // Scroll to top
  container.scrollTop = 0;

  // Wait for content to load
  await new Promise((r) => setTimeout(r, 1200));

  // Click again after scroll in case it appeared
  clickLoadMoreNotice();

  // Check if new content loaded
  const newScrollHeight = container.scrollHeight;
  const newMessageCount = document.querySelectorAll(
    SELECTORS.messageRow,
  ).length;

  const hasNewContent =
    newScrollHeight > prevScrollHeight || newMessageCount > prevMessageCount;

  return hasNewContent;
}

// Main scraping loop
async function scrape() {
  debug("Starting scrape with options:", options);

  const container = getScrollContainer();
  debug("Scroll container:", container ? "found" : "NOT FOUND");

  if (!container) {
    status = "error: no chat open";
    isRunning = false;
    debug("ERROR: No scroll container found");
    return;
  }

  status = "starting...";
  scrollCount = 0;
  noNewContentCount = 0;

  // Initial extraction
  const initial = getVisibleMessages();
  debug("Initial visible messages:", initial.length);
  debug("Sample:", initial.slice(0, 2));

  const initialAdded = mergeMessages(initial);
  debug("After filter, added:", initialAdded, "total:", messages.length);

  while (isRunning && !shouldStop && scrollCount < options.scrollLimit) {
    status = `scrolling ${scrollCount + 1}/${options.scrollLimit}...`;

    // Scroll up
    const hasMore = await scrollUp(container);

    // Extract visible messages
    const visible = getVisibleMessages();
    const added = mergeMessages(visible);

    scrollCount++;

    if (scrollCount % 10 === 0) {
      debug(
        `Progress: scroll ${scrollCount}, messages: ${messages.length}, hasMore: ${hasMore}`,
      );
    }

    // Track if we're getting new content
    if (!hasMore && added === 0) {
      noNewContentCount++;
      debug(`No new content (${noNewContentCount}/3)`);
      // If no new content for 3 consecutive scrolls, we've reached the top
      if (noNewContentCount >= 3) {
        status = "reached top of chat";
        debug("Stopping: reached top of chat");
        break;
      }
    } else {
      noNewContentCount = 0;
    }

    // Small delay to prevent hammering
    await new Promise((r) => setTimeout(r, 200));
  }

  // Final extraction
  const final = getVisibleMessages();
  mergeMessages(final);

  // Sort messages by timestamp (oldest first)
  // Timestamp format: "HH:MM, DD/MM/YYYY"
  messages.sort((a, b) => {
    if (!a.timestamp || !b.timestamp) return 0;

    // Parse timestamp: "HH:MM, DD/MM/YYYY" -> Date
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
}

// Get current chat name from header
function getChatName() {
  // Try multiple selectors for chat header
  const selectors = [
    'header span[dir="auto"][title]',
    "header span[title]",
    '#main header span[dir="auto"]',
    '[data-testid="conversation-header"] span',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const name = el.getAttribute("title") || el.innerText;
      if (name && name.length > 0 && name.length < 100) {
        return name.trim();
      }
    }
  }
  return "unknown-chat";
}

// Message handler from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  switch (request.action) {
    case "info":
      sendResponse({ chatName: getChatName() });
      break;

    case "start":
      if (isRunning) {
        sendResponse({ success: false, error: "Already running" });
        return true;
      }

      options = {
        filter: request.filter || "all",
        includeText: request.includeText !== false,
        includeMedia: request.includeMedia !== false,
        minLength: request.minLength || 0,
        scrollLimit: request.scrollLimit || 50,
      };

      messages = [];
      isRunning = true;
      shouldStop = false;
      noNewContentCount = 0;
      scrape();
      sendResponse({ success: true });
      break;

    case "stop":
      shouldStop = true;
      sendResponse({ success: true });
      break;

    case "status":
      sendResponse({
        messages,
        status,
        done: !isRunning,
        scrollCount,
      });
      break;

    default:
      sendResponse({ error: "Unknown action" });
  }

  return true; // Keep channel open for async response
});

// Debug helper
function debug(...args) {
  console.log("[WA Scraper]", ...args);
}

// Log that content script is loaded
debug("Content script loaded v0.3 - with debugging");

// Expose debug info to console
window.__waScraperDebug = () => {
  const container = getScrollContainer();
  const rows = document.querySelectorAll(SELECTORS.messageRow);
  const messages = getVisibleMessages();

  debug("=== DEBUG INFO ===");
  debug("Scroll container found:", !!container);
  debug("Message rows found:", rows.length);
  debug("Messages extracted:", messages.length);
  debug("Messages with text:", messages.filter((m) => m.text).length);
  debug("Sample messages:", messages.slice(0, 3));
  debug("Current state:", {
    isRunning,
    status,
    scrollCount,
    messagesCollected: messages.length,
  });

  return { container: !!container, rows: rows.length, messages };
};
