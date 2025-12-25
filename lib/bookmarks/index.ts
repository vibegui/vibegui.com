/**
 * Browser Bookmarks Index
 *
 * Factory and discovery functions for all supported browsers.
 */

import type { BrowserType, BrowserProfile, BrowserReader } from "./types.ts";
import { ChromeReader, discoverChromiumProfiles } from "./chrome.ts";
import { FirefoxReader, discoverFirefoxProfiles } from "./firefox.ts";
import { SafariReader, discoverSafariProfiles } from "./safari.ts";

export * from "./types.ts";
export { ChromeReader } from "./chrome.ts";
export { FirefoxReader } from "./firefox.ts";
export { SafariReader } from "./safari.ts";

/**
 * Create a reader for a specific browser
 */
export function createReader(browser: BrowserType): BrowserReader {
  switch (browser) {
    case "chrome":
    case "chromium":
    case "brave":
    case "edge":
    case "dia":
    case "comet":
      return new ChromeReader(browser);
    case "firefox":
      return new FirefoxReader();
    case "safari":
      return new SafariReader();
    default:
      throw new Error(`Unsupported browser: ${browser}`);
  }
}

/**
 * Discover all browser profiles on the system
 */
export async function discoverAllProfiles(): Promise<BrowserProfile[]> {
  const profiles: BrowserProfile[] = [];

  // Chromium browsers
  const chromiumProfiles = await discoverChromiumProfiles();
  profiles.push(...chromiumProfiles);

  // Firefox
  try {
    const firefoxProfiles = await discoverFirefoxProfiles();
    profiles.push(...firefoxProfiles);
  } catch {
    // Firefox not installed or requires better-sqlite3
  }

  // Safari
  try {
    const safariProfiles = await discoverSafariProfiles();
    profiles.push(...safariProfiles);
  } catch {
    // Safari not installed or requires plist
  }

  return profiles;
}

/**
 * Group profiles by browser type
 */
export function groupProfilesByBrowser(
  profiles: BrowserProfile[],
): Map<BrowserType, BrowserProfile[]> {
  const grouped = new Map<BrowserType, BrowserProfile[]>();

  for (const profile of profiles) {
    const existing = grouped.get(profile.browser) || [];
    existing.push(profile);
    grouped.set(profile.browser, existing);
  }

  return grouped;
}

/**
 * Get human-readable browser name
 */
export function getBrowserDisplayName(browser: BrowserType): string {
  const names: Record<BrowserType, string> = {
    chrome: "Google Chrome",
    chromium: "Chromium",
    brave: "Brave",
    edge: "Microsoft Edge",
    firefox: "Firefox",
    safari: "Safari",
    dia: "Dia",
    comet: "Comet",
  };

  return names[browser] || browser;
}
