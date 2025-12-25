/**
 * Chrome/Chromium Browser Reader
 *
 * Reads bookmarks from Chrome, Chromium, Brave, Edge, Dia, and Comet.
 */

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import * as path from "path";
import type { BrowserType } from "./types.ts";
import type {
  BrowserProfile,
  BrowserReader,
  RawBookmark,
  RawBookmarkData,
  RawFolder,
} from "./types.ts";

// ============================================================================
// Browser Paths (macOS)
// ============================================================================

interface ChromiumBrowserConfig {
  browser: BrowserType;
  basePath: string;
  displayName: string;
}

const CHROMIUM_BROWSERS: ChromiumBrowserConfig[] = [
  {
    browser: "chrome",
    basePath: "Google/Chrome",
    displayName: "Google Chrome",
  },
  {
    browser: "chromium",
    basePath: "Chromium",
    displayName: "Chromium",
  },
  {
    browser: "brave",
    basePath: "BraveSoftware/Brave-Browser",
    displayName: "Brave",
  },
  {
    browser: "edge",
    basePath: "Microsoft Edge",
    displayName: "Microsoft Edge",
  },
  {
    browser: "dia",
    basePath: "Dia/User Data",
    displayName: "Dia",
  },
  {
    browser: "comet",
    basePath: "Comet",
    displayName: "Comet",
  },
];

// ============================================================================
// Chrome Bookmarks JSON Structure
// ============================================================================

interface ChromeBookmarkNode {
  id: string;
  name: string;
  type: "url" | "folder";
  url?: string;
  date_added?: string;
  date_modified?: string;
  date_last_used?: string;
  children?: ChromeBookmarkNode[];
  meta_info?: Record<string, unknown>;
}

interface ChromeBookmarksFile {
  checksum: string;
  roots: {
    bookmark_bar: ChromeBookmarkNode;
    other: ChromeBookmarkNode;
    synced: ChromeBookmarkNode;
  };
  version: number;
}

// ============================================================================
// Chrome Reader Implementation
// ============================================================================

export class ChromeReader implements BrowserReader {
  readonly browserType: BrowserType;
  private readonly config: ChromiumBrowserConfig;

  constructor(browser: BrowserType = "chrome") {
    const config = CHROMIUM_BROWSERS.find((b) => b.browser === browser);
    if (!config) {
      // For unknown Chromium browsers, use a generic config
      this.config = {
        browser,
        basePath: browser.charAt(0).toUpperCase() + browser.slice(1),
        displayName: browser.charAt(0).toUpperCase() + browser.slice(1),
      };
    } else {
      this.config = config;
    }
    this.browserType = browser;
  }

  private getBasePath(): string {
    return path.join(
      homedir(),
      "Library/Application Support",
      this.config.basePath,
    );
  }

  async discoverProfiles(): Promise<BrowserProfile[]> {
    const profiles: BrowserProfile[] = [];
    const basePath = this.getBasePath();

    if (!existsSync(basePath)) {
      return profiles;
    }

    // Check Default profile
    const defaultBookmarks = path.join(basePath, "Default", "Bookmarks");
    if (existsSync(defaultBookmarks)) {
      profiles.push({
        browser: this.browserType,
        name: "Default",
        path: path.join(basePath, "Default"),
        bookmarksPath: defaultBookmarks,
        isDefault: true,
      });
    }

    // Check numbered profiles
    try {
      const entries = readdirSync(basePath);
      for (const entry of entries) {
        if (entry.startsWith("Profile ")) {
          const profilePath = path.join(basePath, entry);
          const bookmarksPath = path.join(profilePath, "Bookmarks");

          if (
            statSync(profilePath).isDirectory() &&
            existsSync(bookmarksPath)
          ) {
            const prefsPath = path.join(profilePath, "Preferences");
            let profileName = entry;

            if (existsSync(prefsPath)) {
              try {
                const prefs = JSON.parse(readFileSync(prefsPath, "utf-8"));
                profileName = prefs.profile?.name || entry;
              } catch {
                // Use directory name
              }
            }

            profiles.push({
              browser: this.browserType,
              name: profileName,
              path: profilePath,
              bookmarksPath,
              isDefault: false,
            });
          }
        }
      }
    } catch {
      // Directory listing failed
    }

    return profiles;
  }

  async profileExists(profile: BrowserProfile): Promise<boolean> {
    return existsSync(profile.bookmarksPath);
  }

  async readBookmarks(profile: BrowserProfile): Promise<RawBookmarkData> {
    if (!(await this.profileExists(profile))) {
      throw new Error(`Bookmarks file not found: ${profile.bookmarksPath}`);
    }

    const content = readFileSync(profile.bookmarksPath, "utf-8");
    const data: ChromeBookmarksFile = JSON.parse(content);

    const folders: RawFolder[] = [];
    const bookmarks: RawBookmark[] = [];
    const rootFolders: string[] = [];

    const roots = [
      { key: "bookmark_bar", node: data.roots.bookmark_bar },
      { key: "other", node: data.roots.other },
      { key: "synced", node: data.roots.synced },
    ];

    for (const { key, node } of roots) {
      if (node && node.children && node.children.length > 0) {
        const rootFolder = this.processNode(
          node,
          undefined,
          folders,
          bookmarks,
        );
        if (rootFolder && "children" in rootFolder) {
          (rootFolder as RawFolder).metadata = {
            ...(rootFolder as RawFolder).metadata,
            rootType: key,
          };
          rootFolders.push(rootFolder.id);
        }
      }
    }

    return { folders, bookmarks, rootFolders };
  }

  private processNode(
    node: ChromeBookmarkNode,
    parentId: string | undefined,
    folders: RawFolder[],
    bookmarks: RawBookmark[],
  ): RawFolder | RawBookmark | null {
    if (node.type === "folder") {
      const folder: RawFolder = {
        id: node.id,
        name: node.name,
        parentId,
        dateAdded: node.date_added ? parseInt(node.date_added) : undefined,
        dateModified: node.date_modified
          ? parseInt(node.date_modified)
          : undefined,
        children: [],
        metadata: node.meta_info,
      };

      folders.push(folder);

      if (node.children) {
        for (const child of node.children) {
          const processed = this.processNode(
            child,
            node.id,
            folders,
            bookmarks,
          );
          if (processed) {
            folder.children!.push(processed);
          }
        }
      }

      return folder;
    } else if (node.type === "url" && node.url) {
      const bookmark: RawBookmark = {
        id: node.id,
        url: node.url,
        title: node.name,
        dateAdded: node.date_added ? parseInt(node.date_added) : undefined,
        dateModified: node.date_modified
          ? parseInt(node.date_modified)
          : undefined,
        folderId: parentId,
        metadata: {
          ...node.meta_info,
          dateLastUsed: node.date_last_used,
        },
      };

      bookmarks.push(bookmark);
      return bookmark;
    }

    return null;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

export function createChromiumReaders(): ChromeReader[] {
  return CHROMIUM_BROWSERS.map((config) => new ChromeReader(config.browser));
}

export async function discoverChromiumProfiles(): Promise<BrowserProfile[]> {
  const profiles: BrowserProfile[] = [];

  for (const config of CHROMIUM_BROWSERS) {
    try {
      const reader = new ChromeReader(config.browser);
      const browserProfiles = await reader.discoverProfiles();
      profiles.push(...browserProfiles);
    } catch {
      // Browser not installed
    }
  }

  return profiles;
}
