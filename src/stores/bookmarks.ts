import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bookmark, BookmarkFolder, DatabaseType } from "@/types";
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
