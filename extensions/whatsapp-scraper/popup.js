// State
let isRunning = false;
let scrapedMessages = [];
let writtenMessageIds = new Set();
let fileHandle = null;
let writableStream = null;

// DOM refs
const btnScrape = document.getElementById("btn-scrape");
const btnStop = document.getElementById("btn-stop");
const btnExport = document.getElementById("btn-export");
const btnPickFile = document.getElementById("btn-pick-file");
const outputPath = document.getElementById("output-path");
const statusBar = document.getElementById("status-bar");
const statusText = document.getElementById("status-text");
const statusCount = document.getElementById("status-count");

// Default filename with date and chat name
function getDefaultFilename(chatName = "chat") {
  const date = new Date().toISOString().slice(0, 10);
  // Sanitize chat name for filename
  const safeName = chatName
    .replace(/[^a-zA-Z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 30)
    .toLowerCase();
  return `whatsapp-${safeName}-${date}.txt`;
}

// Get current options from UI
function getOptions() {
  const filter = document.querySelector('input[name="filter"]:checked').value;
  const includeText = document.getElementById("include-text").checked;
  const includeMedia = document.getElementById("include-media").checked;
  const minLength =
    Number.parseInt(document.getElementById("min-length").value) || 0;
  const scrollLimit =
    Number.parseInt(document.getElementById("scroll-limit").value) || 1000;

  return { filter, includeText, includeMedia, minLength, scrollLimit };
}

// Update UI state
function setRunning(running) {
  isRunning = running;
  btnScrape.classList.toggle("hidden", running);
  btnStop.classList.toggle("hidden", !running);
  btnExport.disabled = scrapedMessages.length === 0;
  btnPickFile.disabled = running;
  statusBar.classList.toggle(
    "hidden",
    !running && scrapedMessages.length === 0,
  );
  statusBar.classList.toggle("running", running);
}

function updateStatus(text, count) {
  statusText.textContent = text;
  statusCount.textContent = count !== undefined ? `${count} msgs` : "";
}

function showError(text) {
  statusBar.classList.remove("hidden", "running");
  statusBar.classList.add("error");
  statusText.textContent = text;
  statusCount.textContent = "";
}

// Send message to content script
async function sendToContent(action, data = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.url?.includes("web.whatsapp.com")) {
    showError("Open WhatsApp Web first!");
    return null;
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
    return response;
  } catch (err) {
    showError("Extension not loaded. Refresh WhatsApp Web.");
    console.error(err);
    return null;
  }
}

// Pick output file
async function pickFile() {
  try {
    // Get chat name for suggested filename
    let chatName = "chat";
    const info = await sendToContent("info");
    if (info?.chatName) {
      chatName = info.chatName;
    }

    fileHandle = await window.showSaveFilePicker({
      suggestedName: getDefaultFilename(chatName),
      startIn: "downloads",
      types: [
        {
          description: "Text file",
          accept: { "text/plain": [".txt"] },
        },
      ],
    });

    outputPath.textContent = fileHandle.name;
    outputPath.classList.add("has-file");
    btnScrape.disabled = false;
    console.log("[WA Scraper] File selected:", fileHandle.name);
    return true;
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("File picker error:", err);
      showError("Cannot access file");
    }
    return false;
  }
}

btnPickFile.addEventListener("click", pickFile);
outputPath.addEventListener("click", pickFile);

// Open file stream for streaming writes
async function openStream() {
  if (!fileHandle) {
    console.error("[WA Scraper] No file handle!");
    return false;
  }

  try {
    writableStream = await fileHandle.createWritable();
    // Start fresh
    await writableStream.truncate(0);
    console.log("[WA Scraper] Stream opened for writing");
    return true;
  } catch (err) {
    console.error("[WA Scraper] Failed to open stream:", err);
    showError(`Cannot open file: ${err.message}`);
    return false;
  }
}

// Convert WhatsApp timestamp to ISO format
function toIsoDate(waTimestamp) {
  if (!waTimestamp) return "";
  // Format: "HH:MM, DD/MM/YYYY" -> "YYYY-MM-DDTHH:MM"
  const match = waTimestamp.match(
    /(\d{2}):(\d{2}),?\s*(\d{2})\/(\d{2})\/(\d{4})/,
  );
  if (!match) return waTimestamp;
  const [, hour, min, day, month, year] = match;
  return `${year}-${month}-${day}T${hour}:${min}`;
}

// Append a single message to file
async function appendMessage(message) {
  if (!writableStream) return false;

  // Flatten text to single line (replace newlines with spaces)
  const text = message.text?.trim().replace(/\n+/g, " ");
  if (!text) return false;

  try {
    // Newline before each message (except first)
    const prefix = writtenMessageIds.size > 0 ? "\n" : "";

    // ISO timestamp prefix
    const timestamp = message.timestamp
      ? `[${toIsoDate(message.timestamp)}] `
      : "";

    await writableStream.write(`${prefix}${timestamp}${text}`);
    writtenMessageIds.add(message.id);
    return true;
  } catch (err) {
    console.error("[WA Scraper] Append error:", err);
    return false;
  }
}

// Close the stream
async function closeStream() {
  if (!writableStream) return;

  try {
    await writableStream.close();
    console.log(
      "[WA Scraper] ✓ Stream closed. Total messages:",
      writtenMessageIds.size,
    );
    outputPath.textContent = `✓ ${fileHandle.name} (${writtenMessageIds.size} msgs)`;
  } catch (err) {
    console.error("[WA Scraper] Close error:", err);
  }
  writableStream = null;
}

// Write new messages (streaming - only writes what hasn't been written)
async function writeNewMessages(messages) {
  if (!writableStream) return 0;

  let written = 0;
  for (const msg of messages) {
    if (!writtenMessageIds.has(msg.id)) {
      if (await appendMessage(msg)) {
        written++;
      }
    }
  }

  if (written > 0) {
    console.log(
      "[WA Scraper] Appended",
      written,
      "new messages. Total:",
      writtenMessageIds.size,
    );
  }

  return written;
}

// Start scraping
btnScrape.addEventListener("click", async () => {
  // Auto-pick file if not selected
  if (!fileHandle) {
    const picked = await pickFile();
    if (!picked) return;
  }

  const options = getOptions();
  setRunning(true);
  updateStatus("Starting...", 0);
  scrapedMessages = [];
  writtenMessageIds = new Set();

  // Open file stream for streaming writes
  const streamOpened = await openStream();
  if (!streamOpened) {
    setRunning(false);
    return;
  }

  const response = await sendToContent("start", options);

  if (!response?.success) {
    setRunning(false);
    await closeStream();
    showError(response?.error || "Failed to start");
    return;
  }

  pollProgress();
});

// Stop scraping
btnStop.addEventListener("click", async () => {
  await sendToContent("stop");
  setRunning(false);
  await closeStream();
  updateStatus("Stopped", writtenMessageIds.size);
});

// Poll content script for progress
async function pollProgress() {
  if (!isRunning) return;

  const response = await sendToContent("status");

  if (response) {
    scrapedMessages = response.messages || [];

    // Stream write new messages immediately
    await writeNewMessages(scrapedMessages);

    updateStatus(response.status, writtenMessageIds.size);

    if (response.done) {
      setRunning(false);
      statusBar.classList.remove("running");
      await closeStream();
      updateStatus(
        `Done! Saved ${writtenMessageIds.size}`,
        writtenMessageIds.size,
      );
    } else {
      setTimeout(pollProgress, 500); // Poll faster for streaming
    }
  } else {
    setRunning(false);
    await closeStream();
  }
}

// Manual export button (re-export all messages)
btnExport.addEventListener("click", async () => {
  if (scrapedMessages.length === 0) return;

  // Get chat name for filename
  let chatName = "chat";
  const info = await sendToContent("info");
  if (info?.chatName) chatName = info.chatName;

  downloadFallback(scrapedMessages, getDefaultFilename(chatName));
  updateStatus("Exported!", scrapedMessages.length);
});

// Fallback: Download using data URL (always works)
async function downloadFallback(messages, filename) {
  const formatted = messages.map((m) => {
    const text = m.text?.trim().replace(/\n+/g, " ") || "";
    if (!text) return "";
    const ts = m.timestamp ? `[${toIsoDate(m.timestamp)}] ` : "";
    return `${ts}${text}`;
  });
  const content = formatted.filter((t) => t.length > 0).join("\n");

  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || "whatsapp-export.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log("[WA Scraper] Fallback download triggered:", filename);
}

// Add keyboard shortcut for fallback download (Ctrl+D in popup)
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "d" && scrapedMessages.length > 0) {
    e.preventDefault();
    const chatName = outputPath.textContent.includes("(")
      ? "chat"
      : outputPath.textContent.replace("✓ ", "");
    downloadFallback(scrapedMessages, chatName || getDefaultFilename("chat"));
  }
});

// Initialize - start button works, will prompt for file on click
btnScrape.disabled = false;
