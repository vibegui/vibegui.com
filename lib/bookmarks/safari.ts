/**
 * Safari Browser Reader
 *
 * Reads bookmarks from Safari's Bookmarks.plist file.
 * Note: Requires 'plist' package for binary plist parsing.
 */

import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import * as path from "path";
import type {
  BrowserProfile,
  BrowserReader,
  RawBookmark,
  RawBookmarkData,
  RawFolder,
  BrowserType,
} from "./types.ts";

// ============================================================================
// Safari Plist Types
// ============================================================================

interface SafariBookmarkItem {
  WebBookmarkType:
    | "WebBookmarkTypeList"
    | "WebBookmarkTypeLeaf"
    | "WebBookmarkTypeProxy";
  Title?: string;
  URLString?: string;
  URIDictionary?: {
    title?: string;
  };
  WebBookmarkUUID: string;
  Children?: SafariBookmarkItem[];
  ReadingListNonSync?: {
    neverFetchMetadata?: boolean;
  };
  ShouldOmitFromUI?: boolean;
}

interface SafariBookmarksPlist {
  Title: string;
  WebBookmarkType: string;
  WebBookmarkUUID: string;
  Children: SafariBookmarkItem[];
}

export class SafariReader implements BrowserReader {
  readonly browserType: BrowserType = "safari";

  private getBookmarksPath(): string {
    return path.join(homedir(), "Library/Safari/Bookmarks.plist");
  }

  async discoverProfiles(): Promise<BrowserProfile[]> {
    const bookmarksPath = this.getBookmarksPath();

    if (!existsSync(bookmarksPath)) {
      return [];
    }

    return [
      {
        browser: "safari",
        name: "Default",
        path: path.join(homedir(), "Library/Safari"),
        bookmarksPath,
        isDefault: true,
      },
    ];
  }

  async profileExists(profile: BrowserProfile): Promise<boolean> {
    return existsSync(profile.bookmarksPath);
  }

  async readBookmarks(profile: BrowserProfile): Promise<RawBookmarkData> {
    if (!(await this.profileExists(profile))) {
      throw new Error(`Bookmarks file not found: ${profile.bookmarksPath}`);
    }

    const folders: RawFolder[] = [];
    const bookmarks: RawBookmark[] = [];
    const rootFolders: string[] = [];

    try {
      // Dynamic import for plist
      const plist = await import("plist");
      const content = readFileSync(profile.bookmarksPath);
      const data = plist.parse(
        content.toString(),
      ) as unknown as SafariBookmarksPlist;

      if (data.Children) {
        for (const child of data.Children) {
          if (child.ShouldOmitFromUI || child.ReadingListNonSync) {
            continue;
          }

          const processed = this.processItem(
            child,
            undefined,
            folders,
            bookmarks,
          );
          if (processed && "children" in processed) {
            rootFolders.push(processed.id);
          }
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to read Safari bookmarks: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return { folders, bookmarks, rootFolders };
  }

  private processItem(
    item: SafariBookmarkItem,
    parentId: string | undefined,
    folders: RawFolder[],
    bookmarks: RawBookmark[],
  ): RawFolder | RawBookmark | null {
    if (item.WebBookmarkType === "WebBookmarkTypeProxy") {
      return null;
    }

    if (item.WebBookmarkType === "WebBookmarkTypeList") {
      const folder: RawFolder = {
        id: item.WebBookmarkUUID,
        name: item.Title || "Untitled Folder",
        parentId,
        children: [],
        metadata: {},
      };

      folders.push(folder);

      if (item.Children) {
        for (const child of item.Children) {
          if (child.ShouldOmitFromUI || child.ReadingListNonSync) {
            continue;
          }

          const processed = this.processItem(
            child,
            item.WebBookmarkUUID,
            folders,
            bookmarks,
          );
          if (processed) {
            folder.children!.push(processed);
          }
        }
      }

      return folder;
    } else if (
      item.WebBookmarkType === "WebBookmarkTypeLeaf" &&
      item.URLString
    ) {
      const bookmark: RawBookmark = {
        id: item.WebBookmarkUUID,
        url: item.URLString,
        title: item.URIDictionary?.title || item.Title || item.URLString,
        folderId: parentId,
        metadata: {},
      };

      bookmarks.push(bookmark);
      return bookmark;
    }

    return null;
  }
}

export async function discoverSafariProfiles(): Promise<BrowserProfile[]> {
  const reader = new SafariReader();
  return reader.discoverProfiles();
}
