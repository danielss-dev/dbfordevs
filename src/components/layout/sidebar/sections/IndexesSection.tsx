import { useState } from "react";
import {
  Table,
  Loader2,
  Trash2,
  RefreshCw,
  Copy,
  ListTree,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui";
import { useIndexesStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo, StandaloneIndexInfo } from "@/types";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function IndexesSection({ connection }: { connection: ConnectionInfo }) {
  const indexesByConnection = useIndexesStore(state => state.indexesByConnection);
  const setIndexes = useIndexesStore(state => state.setIndexes);
  const {
    getAllIndexes,
    getIndexDdl,
    dropIndex,
  } = useDatabase();
  const { toast } = useToast();

  // Indexes section state
  const [isLoadingIndexes, setIsLoadingIndexes] = useState(false);
  const [indexToDrop, setIndexToDrop] = useState<{ name: string; tableName?: string } | null>(null);

  // Indexes section handlers
  const handleIndexesClick = async () => {
    // Load indexes on first expansion if not already loaded
    if (connection.connected && !indexesByConnection[connection.id] && !isLoadingIndexes) {
      setIsLoadingIndexes(true);
      try {
        const indexes = await getAllIndexes(connection.id);
        setIndexes(connection.id, indexes);
      } catch (error) {
        console.error("Failed to load indexes:", error);
        showErrorToast("Failed to load indexes", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingIndexes(false);
      }
    }
  };

  const loadConnectionIndexes = async () => {
    setIsLoadingIndexes(true);
    try {
      const indexes = await getAllIndexes(connection.id);
      setIndexes(connection.id, indexes);
    } catch (error) {
      console.error("Failed to load indexes:", error);
      showErrorToast("Failed to load indexes", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingIndexes(false);
    }
  };

  const handleCopyIndexDdl = async (indexName: string, tableName?: string) => {
    try {
      const ddl = await getIndexDdl(connection.id, indexName, tableName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "Index definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this index.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmIndexDrop = async () => {
    if (!indexToDrop) return;
    try {
      const result = await dropIndex(connection.id, indexToDrop.name, indexToDrop.tableName);
      if (result) {
        // Refresh indexes list
        await loadConnectionIndexes();

        toast({
          title: "Index dropped",
          description: `Index "${indexToDrop.name}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop index",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setIndexToDrop(null);
    }
  };

  // Get indexes for this connection
  const connectionIndexes = indexesByConnection[connection.id] || [];

  // Group indexes by table
  const indexesByTable = connectionIndexes.reduce((acc: Record<string, StandaloneIndexInfo[]>, idx) => {
    const tableName = idx.tableName || "Unknown";
    if (!acc[tableName]) {
      acc[tableName] = [];
    }
    acc[tableName].push(idx);
    return acc;
  }, {});
  const indexTableNames = Object.keys(indexesByTable).sort();

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Indexes"
              icon={<ListTree className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={handleIndexesClick}
              defaultOpen={false}
            >
              {isLoadingIndexes ? (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading indexes...</span>
                </div>
              ) : indexTableNames.length > 0 ? (
                indexTableNames.map((tableName) => (
                  <TreeItem
                    key={tableName}
                    label={tableName}
                    icon={<Table className="h-3.5 w-3.5 text-muted-foreground/50" />}
                    level={1}
                    defaultOpen={false}
                  >
                    {indexesByTable[tableName].map((idx) => (
                      <ContextMenu key={idx.name}>
                        <ContextMenuTrigger asChild>
                          <div>
                            <TreeItem
                              label={idx.name}
                              icon={<ListTree className={cn(
                                "h-3.5 w-3.5",
                                idx.isPrimary ? "text-primary" : idx.isUnique ? "text-warning" : "text-muted-foreground"
                              )} />}
                              level={2}
                            />
                          </div>
                        </ContextMenuTrigger>
                        <ContextMenuContent className="w-48">
                          <ContextMenuItem onSelect={() => handleCopyIndexDdl(idx.name, idx.tableName)} className="gap-2">
                            <Copy className="h-4 w-4" />
                            Copy DDL
                          </ContextMenuItem>
                          {!idx.isPrimary && (
                            <>
                              <ContextMenuSeparator />
                              <ContextMenuItem
                                onSelect={() => setIndexToDrop({ name: idx.name, tableName: idx.tableName })}
                                className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                              >
                                <Trash2 className="h-4 w-4" />
                                Drop Index
                              </ContextMenuItem>
                            </>
                          )}
                          {idx.isPrimary && (
                            <div className="px-2 py-1.5 text-xs text-muted-foreground">
                              Primary key (cannot drop)
                            </div>
                          )}
                        </ContextMenuContent>
                      </ContextMenu>
                    ))}
                  </TreeItem>
                ))
              ) : indexesByConnection[connection.id] ? (
                <div className="ml-6 py-2 text-xs text-muted-foreground">No indexes found</div>
              ) : (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading indexes...</span>
                </div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={loadConnectionIndexes} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoadingIndexes && "animate-spin")} />
            Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop Index Confirmation Dialog */}
      <AlertDialog open={!!indexToDrop} onOpenChange={(open) => !open && setIndexToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop Index</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the index "{indexToDrop?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmIndexDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop Index
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
