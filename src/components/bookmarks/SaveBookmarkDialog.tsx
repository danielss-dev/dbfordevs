import { useState, useEffect } from "react";
import { Bookmark, FolderOpen, Globe, FileCode } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUIStore } from "@/stores/ui";
import { useBookmarkStore } from "@/stores/bookmarks";
import { useConnectionsStore } from "@/stores/connections";
import { extractVariables, hasTemplateVariables } from "@/lib/bookmark-templates";
import type { DatabaseType } from "@/types";

export function SaveBookmarkDialog() {
  const {
    showSaveBookmarkDialog,
    setShowSaveBookmarkDialog,
    savingBookmarkSql,
    savingBookmarkConnectionId,
    editingBookmarkId,
  } = useUIStore();

  const {
    addBookmark,
    updateBookmark,
    getBookmarkById,
    folders,
  } = useBookmarkStore();

  const { connections } = useConnectionsStore();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);
  const [isTemplate, setIsTemplate] = useState(false);
  const [sql, setSql] = useState("");
  const [databaseType, setDatabaseType] = useState<DatabaseType | undefined>(undefined);

  // Get connection info
  const currentConnection = connections.find((c) => c.id === savingBookmarkConnectionId);

  // Load existing bookmark when editing
  useEffect(() => {
    if (editingBookmarkId) {
      const bookmark = getBookmarkById(editingBookmarkId);
      if (bookmark) {
        setName(bookmark.name);
        setDescription(bookmark.description || "");
        setFolderId(bookmark.folderId);
        setIsGlobal(bookmark.connectionId === null);
        setIsTemplate(bookmark.isTemplate);
        setSql(bookmark.sql);
        setDatabaseType(bookmark.databaseType);
      }
    } else if (savingBookmarkSql) {
      // Reset form for new bookmark
      setName("");
      setDescription("");
      setFolderId(null);
      setIsGlobal(false);
      setIsTemplate(false);
      setSql(savingBookmarkSql);
      setDatabaseType(currentConnection?.databaseType);
    }
  }, [editingBookmarkId, savingBookmarkSql, getBookmarkById, currentConnection]);

  // Detect if SQL has template variables
  const detectedVariables = hasTemplateVariables(sql) ? extractVariables(sql) : [];

  const handleSave = () => {
    if (!name.trim() || !sql.trim()) return;

    const bookmarkData = {
      name: name.trim(),
      description: description.trim() || undefined,
      sql: sql.trim(),
      folderId,
      connectionId: isGlobal ? null : savingBookmarkConnectionId,
      databaseType: isGlobal ? databaseType : currentConnection?.databaseType,
      isFavorite: false,
      isTemplate,
      variables: isTemplate && detectedVariables.length > 0
        ? detectedVariables.map((v) => ({
            name: v,
            placeholder: `{{${v}}}`,
            defaultValue: "",
          }))
        : undefined,
    };

    if (editingBookmarkId) {
      updateBookmark(editingBookmarkId, bookmarkData);
    } else {
      addBookmark(bookmarkData);
    }

    handleClose();
  };

  const handleClose = () => {
    setShowSaveBookmarkDialog(false);
    // Reset form
    setName("");
    setDescription("");
    setFolderId(null);
    setIsGlobal(false);
    setIsTemplate(false);
    setSql("");
    setDatabaseType(undefined);
  };

  return (
    <Dialog open={showSaveBookmarkDialog} onOpenChange={setShowSaveBookmarkDialog}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bookmark className="h-5 w-5" />
            {editingBookmarkId ? "Edit Bookmark" : "Save Bookmark"}
          </DialogTitle>
          <DialogDescription>
            {editingBookmarkId
              ? "Update your saved query bookmark"
              : "Save this query for quick access later"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="bookmark-name">Name *</Label>
            <Input
              id="bookmark-name"
              placeholder="e.g., Get active users"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="bookmark-description">Description</Label>
            <Textarea
              id="bookmark-description"
              placeholder="Optional description of what this query does"
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Folder */}
          {folders.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="bookmark-folder">Folder</Label>
              <Select
                value={folderId || "none"}
                onValueChange={(value) => setFolderId(value === "none" ? null : value)}
              >
                <SelectTrigger id="bookmark-folder">
                  <SelectValue placeholder="Select folder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <div className="flex items-center gap-2">
                      <FolderOpen className="h-4 w-4" />
                      No folder
                    </div>
                  </SelectItem>
                  {folders.map((folder) => (
                    <SelectItem key={folder.id} value={folder.id}>
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        {folder.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Global checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="bookmark-global"
              checked={isGlobal}
              onCheckedChange={(checked) => setIsGlobal(checked === true)}
            />
            <Label htmlFor="bookmark-global" className="flex items-center gap-2 cursor-pointer">
              <Globe className="h-4 w-4" />
              Available to all connections
            </Label>
          </div>

          {/* Database type selector (only shown when global) */}
          {isGlobal && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="bookmark-db-type">Database Type</Label>
              <Select
                value={databaseType || "any"}
                onValueChange={(value) =>
                  setDatabaseType(value === "any" ? undefined : (value as DatabaseType))
                }
              >
                <SelectTrigger id="bookmark-db-type">
                  <SelectValue placeholder="Select database type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any database</SelectItem>
                  <SelectItem value="postgresql">PostgreSQL</SelectItem>
                  <SelectItem value="mysql">MySQL</SelectItem>
                  <SelectItem value="mariadb">MariaDB</SelectItem>
                  <SelectItem value="sqlite">SQLite</SelectItem>
                  <SelectItem value="mssql">SQL Server</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Template checkbox */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="bookmark-template"
              checked={isTemplate}
              onCheckedChange={(checked) => setIsTemplate(checked === true)}
            />
            <Label htmlFor="bookmark-template" className="flex items-center gap-2 cursor-pointer">
              <FileCode className="h-4 w-4" />
              Save as template
            </Label>
          </div>

          {/* Template variables info */}
          {isTemplate && detectedVariables.length > 0 && (
            <div className="pl-6 text-sm text-muted-foreground">
              <p>Detected variables:</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {detectedVariables.map((v) => (
                  <span
                    key={v}
                    className="px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded text-xs font-mono"
                  >
                    {`{{${v}}}`}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* SQL Preview */}
          <div className="space-y-2">
            <Label>SQL Preview</Label>
            <pre className="text-xs font-mono bg-muted p-3 rounded-md overflow-auto max-h-[150px] whitespace-pre-wrap">
              {sql.length > 500 ? sql.substring(0, 500) + "..." : sql}
            </pre>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || !sql.trim()}>
            {editingBookmarkId ? "Update" : "Save"} Bookmark
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
