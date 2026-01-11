import { useState, useCallback } from "react";
import { Bookmark, Star, Plus, FolderOpen, FileCode } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useBookmarkStore } from "@/stores/bookmarks";
import { useUIStore } from "@/stores/ui";
import { BookmarksDropdownItem } from "./BookmarksDropdownItem";
import { builtInTemplates, hasTemplateVariables } from "@/lib/bookmark-templates";
import type { DatabaseType, Bookmark as BookmarkType } from "@/types";

interface BookmarksDropdownProps {
  connectionId: string | null;
  databaseType?: DatabaseType;
  currentSql: string;
  onLoadBookmark: (sql: string) => void;
}

export function BookmarksDropdown({
  connectionId,
  databaseType,
  currentSql,
  onLoadBookmark,
}: BookmarksDropdownProps) {
  const { getBookmarksForConnection, getFavorites, getRecent } = useBookmarkStore();
  const { openSaveBookmarkDialog, openBookmarkManager, openTemplateVariableDialog } = useUIStore();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Get bookmarks for the current connection
  const connectionBookmarks = getBookmarksForConnection(connectionId, databaseType);
  const favorites = getFavorites().filter(
    (b) => connectionBookmarks.some((cb) => cb.id === b.id) || b.connectionId === null
  );
  const recentBookmarks = getRecent(5).filter(
    (b) => connectionBookmarks.some((cb) => cb.id === b.id) || b.connectionId === null
  );

  // Filter built-in templates for this database type
  const templates = builtInTemplates.filter(
    (t) => !t.databaseType || t.databaseType === databaseType
  );

  const hasBookmarks = connectionBookmarks.length > 0 || templates.length > 0;

  const handleLoadBookmark = useCallback(
    (bookmark: BookmarkType) => {
      // If the bookmark has template variables, open the variable dialog
      if (bookmark.isTemplate && hasTemplateVariables(bookmark.sql)) {
        openTemplateVariableDialog(bookmark.id);
      } else {
        onLoadBookmark(bookmark.sql);
      }
    },
    [onLoadBookmark, openTemplateVariableDialog]
  );

  const handleSaveBookmark = useCallback(() => {
    openSaveBookmarkDialog(currentSql, connectionId);
  }, [currentSql, connectionId, openSaveBookmarkDialog]);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <Bookmark className="h-3.5 w-3.5" />
              Bookmarks
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent>
          {hasBookmarks
            ? `${connectionBookmarks.length} bookmark${connectionBookmarks.length === 1 ? "" : "s"}`
            : "Save and manage query bookmarks"}
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="end" className="w-[400px]">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Query Bookmarks</span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={handleSaveBookmark}
              disabled={!currentSql.trim()}
            >
              <Plus className="h-3 w-3 mr-1" />
              Save
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={openBookmarkManager}
            >
              <FolderOpen className="h-3 w-3 mr-1" />
              Manage
            </Button>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <ScrollArea className="h-[400px]">
          <div className="p-1">
            {/* Favorites Section */}
            {favorites.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3" />
                  <span className="font-medium">Favorites</span>
                </div>
                {favorites.map((bookmark) => (
                  <BookmarksDropdownItem
                    key={bookmark.id}
                    bookmark={bookmark}
                    onClick={() => handleLoadBookmark(bookmark)}
                    isExpanded={hoveredId === bookmark.id}
                    onHover={() => setHoveredId(bookmark.id)}
                    onLeave={() => setHoveredId(null)}
                  />
                ))}
                <DropdownMenuSeparator className="my-2" />
              </>
            )}

            {/* Recent Section */}
            {recentBookmarks.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <Bookmark className="h-3 w-3" />
                  <span className="font-medium">Recent</span>
                </div>
                {recentBookmarks.map((bookmark) => (
                  <BookmarksDropdownItem
                    key={bookmark.id}
                    bookmark={bookmark}
                    onClick={() => handleLoadBookmark(bookmark)}
                    isExpanded={hoveredId === bookmark.id}
                    onHover={() => setHoveredId(bookmark.id)}
                    onLeave={() => setHoveredId(null)}
                  />
                ))}
                <DropdownMenuSeparator className="my-2" />
              </>
            )}

            {/* Templates Section */}
            {templates.length > 0 && (
              <>
                <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground">
                  <FileCode className="h-3 w-3" />
                  <span className="font-medium">Templates</span>
                </div>
                {templates.slice(0, 5).map((template) => (
                  <BookmarksDropdownItem
                    key={template.id}
                    bookmark={template}
                    onClick={() => handleLoadBookmark(template)}
                    isExpanded={hoveredId === template.id}
                    onHover={() => setHoveredId(template.id)}
                    onLeave={() => setHoveredId(null)}
                  />
                ))}
                {templates.length > 5 && (
                  <button
                    type="button"
                    className="w-full text-left px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                    onClick={openBookmarkManager}
                  >
                    + {templates.length - 5} more templates...
                  </button>
                )}
              </>
            )}

            {/* Empty State */}
            {connectionBookmarks.length === 0 && templates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bookmark className="h-8 w-8 text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No bookmarks yet</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Save frequently used queries for quick access
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleSaveBookmark}
                  disabled={!currentSql.trim()}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Save Current Query
                </Button>
              </div>
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
