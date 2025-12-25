// Background service worker
// Handles extension icon click to toggle side panel

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url?.includes("web.whatsapp.com")) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: "togglePanel" });
    } catch (err) {
      console.error("Failed to toggle panel:", err);
    }
  }
});
