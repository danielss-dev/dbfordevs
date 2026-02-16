import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bookmark, BookmarkFolder, BookmarkExportFormat, BookmarkImportResult, DatabaseType } from "@/types";
import { builtInTemplates } from "@/lib/bookmark-templates";

interface BookmarkState {
  // State
  bookmarks: Bookmark[];
  folders: BookmarkFolder[];

  // CRUD Actions for bookmarks
  addBookmark: (bookmark: Omit<Bookmark, "id" | "createdAt" | "updatedAt">) => string;
  updateBookmark: (id: string, updates: Partial<Omit<Bookmark, "id" | "createdAt">>) => void;
  removeBookmark: (id: string) => void;
  duplicateBookmark: (id: string) => string | null;

  // Folder Actions
  addFolder: (folder: Omit<BookmarkFolder, "id" | "createdAt">) => string;
  updateFolder: (id: string, updates: Partial<Omit<BookmarkFolder, "id" | "createdAt">>) => void;
  removeFolder: (id: string) => void;

  // Query Actions
  toggleFavorite: (id: string) => void;
  moveToFolder: (bookmarkId: string, folderId: string | null) => void;

  // Getters
  getBookmarksForConnection: (connectionId: string | null, databaseType?: DatabaseType) => Bookmark[];
  searchBookmarks: (query: string) => Bookmark[];
  getFavorites: () => Bookmark[];
  getRecent: (limit?: number) => Bookmark[];
  getAllTemplates: () => Bookmark[];
  getBookmarkById: (id: string) => Bookmark | undefined;
  getFolderById: (id: string) => BookmarkFolder | undefined;
  getBookmarksInFolder: (folderId: string | null) => Bookmark[];
  getSubFolders: (parentId: string | null) => BookmarkFolder[];

  // Export/Import
  exportBookmarks: (bookmarkIds?: string[]) => BookmarkExportFormat;
  importBookmarks: (data: BookmarkExportFormat, mode: "merge" | "replace") => BookmarkImportResult;
}

// Generate unique ID
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const useBookmarkStore = create<BookmarkState>()(
  persist(
    (set, get) => ({
      bookmarks: [],
      folders: [],

      addBookmark: (bookmark) => {
        const id = generateId();
        const now = Date.now();
        const newBookmark: Bookmark = {
          ...bookmark,
          id,
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({
          bookmarks: [...state.bookmarks, newBookmark],
        }));
        return id;
      },

      updateBookmark: (id, updates) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === id
              ? { ...b, ...updates, updatedAt: Date.now() }
              : b
          ),
        })),

      removeBookmark: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.filter((b) => b.id !== id),
        })),

      duplicateBookmark: (id) => {
        const state = get();
        const original = state.bookmarks.find((b) => b.id === id);
        if (!original) return null;

        const newId = generateId();
        const now = Date.now();
        const duplicate: Bookmark = {
          ...original,
          id: newId,
          name: `${original.name} (Copy)`,
          createdAt: now,
          updatedAt: now,
        };

        set((state) => ({
          bookmarks: [...state.bookmarks, duplicate],
        }));
        return newId;
      },

      addFolder: (folder) => {
        const id = generateId();
        const newFolder: BookmarkFolder = {
          ...folder,
          id,
          createdAt: Date.now(),
        };
        set((state) => ({
          folders: [...state.folders, newFolder],
        }));
        return id;
      },

      updateFolder: (id, updates) =>
        set((state) => ({
          folders: state.folders.map((f) =>
            f.id === id ? { ...f, ...updates } : f
          ),
        })),

      removeFolder: (id) =>
        set((state) => {
          // Get all descendant folder IDs
          const getAllDescendantIds = (parentId: string): string[] => {
            const children = state.folders.filter((f) => f.parentId === parentId);
            return children.flatMap((c) => [c.id, ...getAllDescendantIds(c.id)]);
          };

          const folderIdsToRemove = [id, ...getAllDescendantIds(id)];

          return {
            folders: state.folders.filter((f) => !folderIdsToRemove.includes(f.id)),
            // Move bookmarks in deleted folders to root
            bookmarks: state.bookmarks.map((b) =>
              folderIdsToRemove.includes(b.folderId ?? "")
                ? { ...b, folderId: null }
                : b
            ),
          };
        }),

      toggleFavorite: (id) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === id
              ? { ...b, isFavorite: !b.isFavorite, updatedAt: Date.now() }
              : b
          ),
        })),

      moveToFolder: (bookmarkId, folderId) =>
        set((state) => ({
          bookmarks: state.bookmarks.map((b) =>
            b.id === bookmarkId
              ? { ...b, folderId, updatedAt: Date.now() }
              : b
          ),
        })),

      getBookmarksForConnection: (connectionId, databaseType) => {
        const state = get();
        return state.bookmarks.filter((b) => {
          // Global bookmarks (connectionId === null) are available to all connections
          if (b.connectionId === null) {
            // If database type is specified, filter by it
            if (databaseType && b.databaseType && b.databaseType !== databaseType) {
              return false;
            }
            return true;
          }
          // Connection-specific bookmarks
          return b.connectionId === connectionId;
        });
      },

      searchBookmarks: (query) => {
        const state = get();
        const lowerQuery = query.toLowerCase();
        return state.bookmarks.filter(
          (b) =>
            b.name.toLowerCase().includes(lowerQuery) ||
            b.description?.toLowerCase().includes(lowerQuery) ||
            b.sql.toLowerCase().includes(lowerQuery)
        );
      },

      getFavorites: () => {
        const state = get();
        return state.bookmarks.filter((b) => b.isFavorite);
      },

      getRecent: (limit = 10) => {
        const state = get();
        return [...state.bookmarks]
          .sort((a, b) => b.updatedAt - a.updatedAt)
          .slice(0, limit);
      },

      getAllTemplates: () => {
        const state = get();
        // Combine built-in templates with user-created templates
        const userTemplates = state.bookmarks.filter((b) => b.isTemplate);
        return [...builtInTemplates, ...userTemplates];
      },

      getBookmarkById: (id) => {
        const state = get();
        // Check user bookmarks first
        const userBookmark = state.bookmarks.find((b) => b.id === id);
        if (userBookmark) return userBookmark;
        // Check built-in templates
        return builtInTemplates.find((b) => b.id === id);
      },

      getFolderById: (id) => {
        const state = get();
        return state.folders.find((f) => f.id === id);
      },

      getBookmarksInFolder: (folderId) => {
        const state = get();
        return state.bookmarks.filter((b) => b.folderId === folderId);
      },

      getSubFolders: (parentId) => {
        const state = get();
        return state.folders.filter((f) => f.parentId === parentId);
      },

      exportBookmarks: (bookmarkIds) => {
        const state = get();
        let bookmarksToExport: Bookmark[];
        let foldersToExport: BookmarkFolder[];

        if (bookmarkIds && bookmarkIds.length > 0) {
          bookmarksToExport = state.bookmarks.filter(
            (b) => bookmarkIds.includes(b.id) && !b.id.startsWith("builtin-")
          );
          // Include folders referenced by exported bookmarks
          const folderIds = new Set(
            bookmarksToExport.map((b) => b.folderId).filter(Boolean) as string[]
          );
          foldersToExport = state.folders.filter((f) => folderIds.has(f.id));
        } else {
          bookmarksToExport = state.bookmarks.filter((b) => !b.id.startsWith("builtin-"));
          foldersToExport = [...state.folders];
        }

        return {
          formatVersion: 1,
          exportedAt: Date.now(),
          appName: "dbfordevs",
          bookmarks: bookmarksToExport,
          folders: foldersToExport,
        };
      },

      importBookmarks: (data, mode) => {
        const result: BookmarkImportResult = {
          success: true,
          imported: 0,
          skipped: 0,
          foldersImported: 0,
          errors: [],
        };

        try {
          // Build folder ID mapping (old -> new)
          const folderIdMap = new Map<string, string>();
          const newFolders: BookmarkFolder[] = [];
          for (const folder of data.folders) {
            const newId = generateId();
            folderIdMap.set(folder.id, newId);
            newFolders.push({
              ...folder,
              id: newId,
              parentId: folder.parentId ? (folderIdMap.get(folder.parentId) ?? null) : null,
              createdAt: Date.now(),
            });
            result.foldersImported++;
          }

          // Remap parent IDs that were set before their parent was processed
          for (const folder of newFolders) {
            if (folder.parentId === null) continue;
            // Find the original folder to get its original parentId
            const originalFolder = data.folders.find(
              (f) => folderIdMap.get(f.id) === folder.id
            );
            if (originalFolder?.parentId) {
              folder.parentId = folderIdMap.get(originalFolder.parentId) ?? null;
            }
          }

          // Build new bookmarks
          const now = Date.now();
          const newBookmarks: Bookmark[] = [];
          for (const bookmark of data.bookmarks) {
            if (bookmark.id.startsWith("builtin-")) {
              result.skipped++;
              continue;
            }
            newBookmarks.push({
              ...bookmark,
              id: generateId(),
              folderId: bookmark.folderId ? (folderIdMap.get(bookmark.folderId) ?? null) : null,
              connectionId: null,
              createdAt: now,
              updatedAt: now,
            });
            result.imported++;
          }

          if (mode === "replace") {
            set({ bookmarks: newBookmarks, folders: newFolders });
          } else {
            set((state) => ({
              bookmarks: [...state.bookmarks, ...newBookmarks],
              folders: [...state.folders, ...newFolders],
            }));
          }
        } catch (err) {
          result.success = false;
          result.errors.push(err instanceof Error ? err.message : String(err));
        }

        return result;
      },
    }),
    {
      name: "dbfordevs-bookmarks",
      partialize: (state) => ({
        bookmarks: state.bookmarks,
        folders: state.folders,
      }),
    }
  )
);

// Selectors
export const selectBookmarks = (state: BookmarkState) => state.bookmarks;
export const selectFolders = (state: BookmarkState) => state.folders;
export const selectFavoriteBookmarks = (state: BookmarkState) =>
  state.bookmarks.filter((b) => b.isFavorite);
