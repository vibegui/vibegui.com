/**
 * Firefox Browser Reader
 *
 * Reads bookmarks from Firefox's places.sqlite database.
 * Note: Requires 'better-sqlite3' package for SQLite reading.
 */

import { existsSync, readdirSync, readFileSync } from "fs";
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

// Firefox bookmark types
const FIREFOX_TYPE_BOOKMARK = 1;
const FIREFOX_TYPE_FOLDER = 2;

// Special folder IDs
const FIREFOX_ROOT_ID = 1;
const FIREFOX_MENU_ID = 2;
const FIREFOX_TOOLBAR_ID = 3;
const FIREFOX_UNFILED_ID = 5;
const FIREFOX_MOBILE_ID = 6;

export class FirefoxReader implements BrowserReader {
  readonly browserType: BrowserType = "firefox";

  private getProfilesPath(): string {
    return path.join(homedir(), "Library/Application Support/Firefox/Profiles");
  }

  async discoverProfiles(): Promise<BrowserProfile[]> {
    const profiles: BrowserProfile[] = [];
    const profilesPath = this.getProfilesPath();

    if (!existsSync(profilesPath)) {
      return profiles;
    }

    // Read profiles.ini
    const profilesIni = path.join(
      homedir(),
      "Library/Application Support/Firefox/profiles.ini",
    );

    const profileDirs = new Map<string, { name: string; isDefault: boolean }>();

    if (existsSync(profilesIni)) {
      try {
        const content = readFileSync(profilesIni, "utf-8");
        let currentProfile: {
          path?: string;
          name?: string;
          isDefault?: boolean;
        } = {};

        for (const line of content.split("\n")) {
          const trimmed = line.trim();

          if (trimmed.startsWith("[Profile")) {
            if (currentProfile.path && currentProfile.name) {
              const fullPath = currentProfile.path.startsWith("/")
                ? currentProfile.path
                : path.join(profilesPath, path.basename(currentProfile.path));
              profileDirs.set(fullPath, {
                name: currentProfile.name,
                isDefault: currentProfile.isDefault || false,
              });
            }
            currentProfile = {};
          } else if (trimmed.startsWith("Path=")) {
            currentProfile.path = trimmed.slice(5);
          } else if (trimmed.startsWith("Name=")) {
            currentProfile.name = trimmed.slice(5);
          } else if (trimmed === "Default=1") {
            currentProfile.isDefault = true;
          }
        }

        if (currentProfile.path && currentProfile.name) {
          const fullPath = currentProfile.path.startsWith("/")
            ? currentProfile.path
            : path.join(profilesPath, path.basename(currentProfile.path));
          profileDirs.set(fullPath, {
            name: currentProfile.name,
            isDefault: currentProfile.isDefault || false,
          });
        }
      } catch {
        // Fall back to directory scanning
      }
    }

    // Scan for profile directories
    try {
      const entries = readdirSync(profilesPath);

      for (const entry of entries) {
        const profilePath = path.join(profilesPath, entry);
        const placesPath = path.join(profilePath, "places.sqlite");

        if (existsSync(placesPath)) {
          const info = profileDirs.get(profilePath) || {
            name: entry,
            isDefault: entry.includes(".default"),
          };

          profiles.push({
            browser: "firefox",
            name: info.name,
            path: profilePath,
            bookmarksPath: placesPath,
            isDefault: info.isDefault,
          });
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
      throw new Error(`Places database not found: ${profile.bookmarksPath}`);
    }

    const folders: RawFolder[] = [];
    const bookmarks: RawBookmark[] = [];
    const rootFolders: string[] = [];

    try {
      // Dynamic import for better-sqlite3
      const Database = (await import("better-sqlite3")).default;
      const db = new Database(profile.bookmarksPath, { readonly: true });

      try {
        const rows = db
          .prepare(
            `
          SELECT 
            b.id,
            b.type,
            b.fk,
            b.parent,
            b.position,
            b.title,
            b.dateAdded,
            b.lastModified,
            b.guid,
            p.url,
            p.title as place_title,
            p.visit_count,
            p.last_visit_date
          FROM moz_bookmarks b
          LEFT JOIN moz_places p ON b.fk = p.id
          WHERE b.type IN (1, 2)
          ORDER BY b.parent, b.position
        `,
          )
          .all() as Array<{
          id: number;
          type: number;
          fk: number | null;
          parent: number;
          position: number;
          title: string | null;
          dateAdded: number;
          lastModified: number;
          guid: string;
          url: string | null;
          place_title: string | null;
          visit_count: number;
          last_visit_date: number | null;
        }>;

        const itemMap = new Map<number, RawFolder | RawBookmark>();

        for (const row of rows) {
          if (row.type === FIREFOX_TYPE_FOLDER) {
            const folder: RawFolder = {
              id: row.guid,
              name: row.title || "Untitled Folder",
              parentId: undefined,
              dateAdded: row.dateAdded,
              dateModified: row.lastModified,
              children: [],
              metadata: {
                firefoxId: row.id,
                position: row.position,
              },
            };

            folders.push(folder);
            itemMap.set(row.id, folder);

            if (
              row.parent === FIREFOX_ROOT_ID &&
              [
                FIREFOX_MENU_ID,
                FIREFOX_TOOLBAR_ID,
                FIREFOX_UNFILED_ID,
                FIREFOX_MOBILE_ID,
              ].includes(row.id)
            ) {
              rootFolders.push(folder.id);
            }
          } else if (row.type === FIREFOX_TYPE_BOOKMARK && row.url) {
            const bookmark: RawBookmark = {
              id: row.guid,
              url: row.url,
              title: row.title || row.place_title || row.url,
              dateAdded: row.dateAdded,
              dateModified: row.lastModified,
              folderId: undefined,
              metadata: {
                firefoxId: row.id,
                visitCount: row.visit_count,
                lastVisitDate: row.last_visit_date,
                position: row.position,
              },
            };

            bookmarks.push(bookmark);
            itemMap.set(row.id, bookmark);
          }
        }

        // Link parents
        for (const row of rows) {
          if (row.parent && row.parent !== FIREFOX_ROOT_ID) {
            const parentFolder = itemMap.get(row.parent) as
              | RawFolder
              | undefined;
            const item = itemMap.get(row.id);

            if (parentFolder && item && "children" in parentFolder) {
              if ("url" in item) {
                (item as RawBookmark).folderId = parentFolder.id;
              } else {
                (item as RawFolder).parentId = parentFolder.id;
              }
              parentFolder.children!.push(item);
            }
          }
        }
      } finally {
        db.close();
      }
    } catch (error) {
      // If better-sqlite3 fails, throw meaningful error
      throw new Error(
        `Failed to read Firefox bookmarks: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    return { folders, bookmarks, rootFolders };
  }
}

export async function discoverFirefoxProfiles(): Promise<BrowserProfile[]> {
  const reader = new FirefoxReader();
  return reader.discoverProfiles();
}
