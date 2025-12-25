/**
 * Browser Bookmark Types
 *
 * Common interfaces for reading bookmarks from different browsers.
 */

// ============================================================================
// Browser Types
// ============================================================================

export type BrowserType =
  | "chrome"
  | "firefox"
  | "safari"
  | "brave"
  | "edge"
  | "dia"
  | "comet"
  | "chromium";

// ============================================================================
// Raw Bookmark Data
// ============================================================================

/**
 * Raw bookmark as read from a browser
 */
export interface RawBookmark {
  id: string;
  url: string;
  title: string;
  dateAdded?: number;
  dateModified?: number;
  folderId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Raw folder as read from a browser
 */
export interface RawFolder {
  id: string;
  name: string;
  parentId?: string;
  dateAdded?: number;
  dateModified?: number;
  children?: Array<RawBookmark | RawFolder>;
  metadata?: Record<string, unknown>;
}

/**
 * Complete bookmark structure from a browser
 */
export interface RawBookmarkData {
  folders: RawFolder[];
  bookmarks: RawBookmark[];
  rootFolders: string[];
}

// ============================================================================
// Browser Profile
// ============================================================================

/**
 * Discovered browser profile
 */
export interface BrowserProfile {
  browser: BrowserType;
  name: string;
  path: string;
  bookmarksPath: string;
  isDefault: boolean;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Reader Interface
// ============================================================================

/**
 * Browser reader interface
 */
export interface BrowserReader {
  readonly browserType: BrowserType;
  discoverProfiles(): Promise<BrowserProfile[]>;
  profileExists(profile: BrowserProfile): Promise<boolean>;
  readBookmarks(profile: BrowserProfile): Promise<RawBookmarkData>;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a raw item is a folder
 */
export function isRawFolder(item: RawBookmark | RawFolder): item is RawFolder {
  return "children" in item || !("url" in item);
}

/**
 * Convert Chrome timestamp (microseconds since 1601) to Date
 */
export function chromeTimestampToDate(timestamp: number): Date {
  const CHROME_EPOCH_OFFSET = 11644473600000000;
  const unixMicroseconds = timestamp - CHROME_EPOCH_OFFSET;
  return new Date(unixMicroseconds / 1000);
}

/**
 * Convert Firefox timestamp (microseconds since 1970) to Date
 */
export function firefoxTimestampToDate(timestamp: number): Date {
  return new Date(timestamp / 1000);
}

/**
 * Convert Date to Chrome timestamp
 */
export function dateToChromeTimetamp(date: Date): number {
  const CHROME_EPOCH_OFFSET = 11644473600000000;
  return date.getTime() * 1000 + CHROME_EPOCH_OFFSET;
}
