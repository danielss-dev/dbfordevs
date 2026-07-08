import { useState, useCallback, useMemo } from "react";
import {
  Bookmark,
  Star,
  FolderOpen,
  FolderPlus,
  FileCode,
  Search,
  Trash2,
  Copy,
  Edit,
  Play,
  MoreHorizontal,
  Globe,
  Download,
  Upload,
} from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useUIStore } from "@/stores/ui";
import { useBookmarkStore } from "@/stores/bookmarks";
import { builtInTemplates, hasTemplateVariables } from "@/lib/bookmark-templates";
import { cn } from "@/lib/utils";
import { validateBookmarkExport } from "@/lib/bookmark-templates";
import { showSuccessToast, showErrorToast } from "@/lib/toast-helpers";
import type { Bookmark as BookmarkType, BookmarkExportFormat } from "@/types";

type FilterCategory = "all" | "favorites" | "templates" | "folder";

interface BookmarkManagerDialogProps {
  onLoadBookmark: (sql: string) => void;
}

export function BookmarkManagerDialog({ onLoadBookmark }: BookmarkManagerDialogProps) {
  const {
    showBookmarkManagerDialog,
    setShowBookmarkManagerDialog,
    openEditBookmarkDialog,
    openTemplateVariableDialog,
  } = useUIStore();

  const {
    bookmarks,
    folders,
    removeBookmark,
    duplicateBookmark,
    toggleFavorite,
    addFolder,
    removeFolder,
    updateFolder,
    exportBookmarks,
    importBookmarks,
  } = useBookmarkStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>("all");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ type: "bookmark" | "folder"; id: string } | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<BookmarkExportFormat | null>(null);

  // Filter bookmarks based on category and search
  const filteredBookmarks = useMemo(() => {
    let result: BookmarkType[] = [];

    if (selectedCategory === "all") {
      result = [...bookmarks];
    } else if (selectedCategory === "favorites") {
      result = bookmarks.filter((b) => b.isFavorite);
    } else if (selectedCategory === "templates") {
      result = [...builtInTemplates, ...bookmarks.filter((b) => b.isTemplate)];
    } else if (selectedCategory === "folder" && selectedFolderId) {
      result = bookmarks.filter((b) => b.folderId === selectedFolderId);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (b) =>
          b.name.toLowerCase().includes(query) ||
          b.description?.toLowerCase().includes(query) ||
          b.sql.toLowerCase().includes(query)
      );
    }

    return result;
  }, [bookmarks, selectedCategory, selectedFolderId, searchQuery]);

  const handleCategorySelect = useCallback((category: FilterCategory, folderId?: string) => {
    setSelectedCategory(category);
    setSelectedFolderId(folderId || null);
  }, []);

  const handleLoadBookmark = useCallback(
    (bookmark: BookmarkType) => {
      if (bookmark.isTemplate && hasTemplateVariables(bookmark.sql)) {
        openTemplateVariableDialog(bookmark.id);
      } else {
        onLoadBookmark(bookmark.sql);
        setShowBookmarkManagerDialog(false);
      }
    },
    [onLoadBookmark, openTemplateVariableDialog, setShowBookmarkManagerDialog]
  );

  const handleEdit = useCallback(
    (bookmarkId: string) => {
      openEditBookmarkDialog(bookmarkId);
    },
    [openEditBookmarkDialog]
  );

  const handleDuplicate = useCallback(
    (bookmarkId: string) => {
      duplicateBookmark(bookmarkId);
    },
    [duplicateBookmark]
  );

  const handleDeleteClick = useCallback((type: "bookmark" | "folder", id: string) => {
    setItemToDelete({ type, id });
    setDeleteDialogOpen(true);
  }, []);

  const handleDeleteConfirm = useCallback(() => {
    if (itemToDelete) {
      if (itemToDelete.type === "bookmark") {
        removeBookmark(itemToDelete.id);
      } else {
        removeFolder(itemToDelete.id);
        if (selectedFolderId === itemToDelete.id) {
          setSelectedCategory("all");
          setSelectedFolderId(null);
        }
      }
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  }, [itemToDelete, removeBookmark, removeFolder, selectedFolderId]);

  const handleCreateFolder = useCallback(() => {
    if (newFolderName.trim()) {
      addFolder({ name: newFolderName.trim(), parentId: null });
      setNewFolderName("");
      setIsCreatingFolder(false);
    }
  }, [newFolderName, addFolder]);

  const handleUpdateFolder = useCallback(() => {
    if (editingFolderId && editingFolderName.trim()) {
      updateFolder(editingFolderId, { name: editingFolderName.trim() });
      setEditingFolderId(null);
      setEditingFolderName("");
    }
  }, [editingFolderId, editingFolderName, updateFolder]);

  const handleExport = useCallback(async () => {
    try {
      const data = exportBookmarks();
      const filePath = await save({
        title: "Export Bookmarks",
        defaultPath: "dbfordevs-bookmarks.json",
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      await writeTextFile(filePath, JSON.stringify(data, null, 2));
      showSuccessToast("Bookmarks exported", `${data.bookmarks.length} bookmarks exported`);
    } catch (err) {
      showErrorToast("Export failed", err instanceof Error ? err.message : String(err));
    }
  }, [exportBookmarks]);

  const handleImportFile = useCallback(async () => {
    try {
      const filePath = await open({
        title: "Import Bookmarks",
        filters: [{ name: "JSON", extensions: ["json"] }],
        multiple: false,
        directory: false,
      });
      if (!filePath) return;

      const content = await readTextFile(filePath);
      const parsed = JSON.parse(content);
      const validation = validateBookmarkExport(parsed);

      if (!validation.valid) {
        showErrorToast("Invalid file", validation.errors[0]);
        return;
      }

      setImportData(parsed as BookmarkExportFormat);
      setImportDialogOpen(true);
    } catch (err) {
      showErrorToast("Import failed", err instanceof Error ? err.message : String(err));
    }
  }, []);

  const handleImportConfirm = useCallback(
    (mode: "merge" | "replace") => {
      if (!importData) return;
      const result = importBookmarks(importData, mode);
      if (result.success) {
        showSuccessToast(
          "Bookmarks imported",
          `${result.imported} bookmarks and ${result.foldersImported} folders imported${result.skipped > 0 ? `, ${result.skipped} skipped` : ""}`
        );
      } else {
        showErrorToast("Import failed", result.errors[0]);
      }
      setImportDialogOpen(false);
      setImportData(null);
    },
    [importData, importBookmarks]
  );

  // Check if a bookmark is a built-in template (non-editable)
  const isBuiltIn = (bookmark: BookmarkType) => bookmark.id.startsWith("builtin-");

  return (
    <>
      <Dialog open={showBookmarkManagerDialog} onOpenChange={setShowBookmarkManagerDialog}>
        <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 py-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Bookmark className="h-5 w-5" />
                Bookmark Manager
              </DialogTitle>
              <div className="flex items-center gap-2 mr-6">
                <Button variant="outline" size="sm" className="gap-2" onClick={handleExport}>
                  <Download className="h-3.5 w-3.5" />
                  Export
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleImportFile}>
                  <Upload className="h-3.5 w-3.5" />
                  Import
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar */}
            <div className="w-56 border-r flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-1">
                  {/* All bookmarks */}
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      "hover:bg-accent transition-colors",
                      selectedCategory === "all" && "bg-accent"
                    )}
                    onClick={() => handleCategorySelect("all")}
                  >
                    <Bookmark className="h-4 w-4" />
                    All Bookmarks
                    <span className="ml-auto text-xs text-muted-foreground">
                      {bookmarks.length}
                    </span>
                  </button>

                  {/* Favorites */}
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      "hover:bg-accent transition-colors",
                      selectedCategory === "favorites" && "bg-accent"
                    )}
                    onClick={() => handleCategorySelect("favorites")}
                  >
                    <Star className="h-4 w-4" />
                    Favorites
                    <span className="ml-auto text-xs text-muted-foreground">
                      {bookmarks.filter((b) => b.isFavorite).length}
                    </span>
                  </button>

                  {/* Templates */}
                  <button
                    type="button"
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      "hover:bg-accent transition-colors",
                      selectedCategory === "templates" && "bg-accent"
                    )}
                    onClick={() => handleCategorySelect("templates")}
                  >
                    <FileCode className="h-4 w-4" />
                    Templates
                    <span className="ml-auto text-xs text-muted-foreground">
                      {builtInTemplates.length + bookmarks.filter((b) => b.isTemplate).length}
                    </span>
                  </button>

                  {/* Folders section */}
                  <div className="pt-4">
                    <div className="flex items-center justify-between px-3 py-1">
                      <span className="text-xs font-medium text-muted-foreground uppercase">
                        Folders
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0"
                        onClick={() => setIsCreatingFolder(true)}
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* New folder input */}
                    {isCreatingFolder && (
                      <div className="px-2 py-1">
                        <Input
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Folder name"
                          className="h-8 text-sm"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCreateFolder();
                            if (e.key === "Escape") {
                              setIsCreatingFolder(false);
                              setNewFolderName("");
                            }
                          }}
                          onBlur={() => {
                            if (!newFolderName.trim()) {
                              setIsCreatingFolder(false);
                            }
                          }}
                        />
                      </div>
                    )}

                    {/* Folder list */}
                    {folders.map((folder) => (
                      <div key={folder.id} className="group">
                        {editingFolderId === folder.id ? (
                          <div className="px-2 py-1">
                            <Input
                              value={editingFolderName}
                              onChange={(e) => setEditingFolderName(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleUpdateFolder();
                                if (e.key === "Escape") {
                                  setEditingFolderId(null);
                                  setEditingFolderName("");
                                }
                              }}
                              onBlur={handleUpdateFolder}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                              "hover:bg-accent transition-colors",
                              selectedCategory === "folder" && selectedFolderId === folder.id && "bg-accent"
                            )}
                            onClick={() => handleCategorySelect("folder", folder.id)}
                          >
                            <FolderOpen className="h-4 w-4" />
                            <span className="truncate flex-1 text-left">{folder.name}</span>
                            <span className="text-xs text-muted-foreground">
                              {bookmarks.filter((b) => b.folderId === folder.id).length}
                            </span>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingFolderId(folder.id);
                                    setEditingFolderName(folder.name);
                                  }}
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Rename
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteClick("folder", folder.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </ScrollArea>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Search bar */}
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search bookmarks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Bookmark list */}
              <ScrollArea className="flex-1">
                <div className="p-4 space-y-2">
                  {filteredBookmarks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <Bookmark className="h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        {searchQuery ? "No bookmarks match your search" : "No bookmarks yet"}
                      </p>
                    </div>
                  ) : (
                    filteredBookmarks.map((bookmark) => (
                      <div
                        key={bookmark.id}
                        className="group rounded-lg border hover:bg-accent/50 transition-colors overflow-hidden"
                      >
                        {/* Header row */}
                        <div className="flex items-center gap-3 p-3 pb-2">
                          {/* Favorite toggle */}
                          <button
                            type="button"
                            className="flex-shrink-0"
                            onClick={() => !isBuiltIn(bookmark) && toggleFavorite(bookmark.id)}
                            disabled={isBuiltIn(bookmark)}
                          >
                            <Star
                              className={cn(
                                "h-4 w-4 transition-colors",
                                bookmark.isFavorite
                                  ? "text-yellow-500 fill-yellow-500"
                                  : "text-muted-foreground hover:text-yellow-500"
                              )}
                            />
                          </button>

                          {/* Title and badges */}
                          <div className="flex-1 min-w-0 flex items-center gap-2">
                            <span className="font-medium truncate">{bookmark.name}</span>
                            {bookmark.isTemplate && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary flex-shrink-0">
                                Template
                              </span>
                            )}
                            {isBuiltIn(bookmark) && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-info/10 text-info flex-shrink-0">
                                Built-in
                              </span>
                            )}
                            {bookmark.connectionId === null && !isBuiltIn(bookmark) && (
                              <Globe className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2"
                              onClick={() => handleLoadBookmark(bookmark)}
                            >
                              <Play className="h-4 w-4 mr-1" />
                              Use
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleLoadBookmark(bookmark)}>
                                  <Play className="h-4 w-4 mr-2" />
                                  Use Query
                                </DropdownMenuItem>
                                {!isBuiltIn(bookmark) && (
                                  <>
                                    <DropdownMenuItem onClick={() => handleEdit(bookmark.id)}>
                                      <Edit className="h-4 w-4 mr-2" />
                                      Edit
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => handleDuplicate(bookmark.id)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Duplicate
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteClick("bookmark", bookmark.id)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* Description */}
                        {bookmark.description && (
                          <p className="text-sm text-muted-foreground px-3 pb-2">
                            {bookmark.description}
                          </p>
                        )}

                        {/* SQL preview */}
                        <pre className="text-xs font-mono text-muted-foreground mx-3 mb-3 p-2 rounded bg-muted/50 overflow-x-auto max-h-24 whitespace-pre-wrap break-all">
                          {bookmark.sql.length > 300 ? bookmark.sql.substring(0, 300) + "..." : bookmark.sql}
                        </pre>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {itemToDelete?.type === "folder" ? "Folder" : "Bookmark"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {itemToDelete?.type === "folder"
                ? "This will delete the folder. Bookmarks in this folder will be moved to the root level."
                : "This will permanently delete this bookmark."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import confirmation dialog */}
      <AlertDialog open={importDialogOpen} onOpenChange={(open) => { setImportDialogOpen(open); if (!open) setImportData(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import Bookmarks</AlertDialogTitle>
            <AlertDialogDescription>
              Found {importData?.bookmarks.length ?? 0} bookmarks and{" "}
              {importData?.folders.length ?? 0} folders. How would you like to import them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => handleImportConfirm("replace")} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Replace All
            </AlertDialogAction>
            <AlertDialogAction onClick={() => handleImportConfirm("merge")}>
              Merge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
