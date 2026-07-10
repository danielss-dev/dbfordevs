import { useState } from "react";
import {
  Table,
  Loader2,
  Trash2,
  RefreshCw,
  Copy,
  Eye,
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
import { useQueryStore, useViewsStore } from "@/stores";
import { useDatabase, useToast } from "@/hooks";
import type { ConnectionInfo } from "@/types";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showInfoToast } from "@/lib/toast-helpers";
import { TreeItem } from "../TreeItem";

export function ViewsSection({ connection }: { connection: ConnectionInfo }) {
  const addTab = useQueryStore(state => state.addTab);
  const tabs = useQueryStore(state => state.tabs);
  const setActiveTab = useQueryStore(state => state.setActiveTab);
  const removeTab = useQueryStore(state => state.removeTab);
  const viewsByConnection = useViewsStore(state => state.viewsByConnection);
  const setViews = useViewsStore(state => state.setViews);
  const {
    getViews,
    getViewDdl,
    dropView,
  } = useDatabase();
  const { toast } = useToast();

  // Views section state
  const [isLoadingViews, setIsLoadingViews] = useState(false);
  const [viewToDrop, setViewToDrop] = useState<string | null>(null);

  // Views section handlers
  const handleViewsClick = async () => {
    // Load views on first expansion if not already loaded
    if (connection.connected && !viewsByConnection[connection.id] && !isLoadingViews) {
      setIsLoadingViews(true);
      try {
        const views = await getViews(connection.id);
        setViews(connection.id, views);
      } catch (error) {
        console.error("Failed to load views:", error);
        showErrorToast("Failed to load views", error instanceof Error ? error.message : String(error));
      } finally {
        setIsLoadingViews(false);
      }
    }
  };

  const loadConnectionViews = async () => {
    setIsLoadingViews(true);
    try {
      const views = await getViews(connection.id);
      setViews(connection.id, views);
    } catch (error) {
      console.error("Failed to load views:", error);
      showErrorToast("Failed to load views", error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingViews(false);
    }
  };

  const handleViewClick = (viewName: string) => {
    // Open view data in a table-like tab
    const tabId = `view-${connection.id}-${viewName}`;
    const existingTab = tabs.find((t) => t.id === tabId);

    if (existingTab) {
      setActiveTab(tabId);
    } else {
      addTab({
        id: tabId,
        title: viewName,
        tableName: viewName,
        type: "table", // Views can be queried like tables
        connectionId: connection.id,
      });
    }
  };

  const handleCopyViewDdl = async (viewName: string) => {
    try {
      const ddl = await getViewDdl(connection.id, viewName);
      if (ddl) {
        const success = await copyToClipboard(ddl);
        if (success) {
          showInfoToast("DDL Copied", "View definition copied to clipboard.");
        } else {
          throw new Error("Failed to copy to clipboard");
        }
      } else {
        showErrorToast("Copy Failed", "Could not get DDL for this view.");
      }
    } catch (error) {
      showErrorToast("Copy Failed", error instanceof Error ? error.message : String(error));
    }
  };

  const confirmViewDrop = async () => {
    if (!viewToDrop) return;
    try {
      const result = await dropView(connection.id, viewToDrop);
      if (result) {
        // Remove associated tab if open
        const tabId = `view-${connection.id}-${viewToDrop}`;
        removeTab(tabId);
        // Refresh views list
        await loadConnectionViews();

        toast({
          title: "View dropped",
          description: `View "${viewToDrop}" has been dropped successfully.`,
          variant: "success",
        });
      }
    } catch (error) {
      toast({
        title: "Failed to drop view",
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      });
    } finally {
      setViewToDrop(null);
    }
  };

  // Get views for this connection
  const connectionViews = viewsByConnection[connection.id] || [];

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div>
            <TreeItem
              label="Views"
              icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
              onClick={handleViewsClick}
              defaultOpen={false}
            >
              {isLoadingViews ? (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading views...</span>
                </div>
              ) : connectionViews.length > 0 ? (
                connectionViews.map((view) => (
                  <ContextMenu key={view.name}>
                    <ContextMenuTrigger asChild>
                      <div>
                        <TreeItem
                          label={view.name}
                          icon={<Eye className="h-3.5 w-3.5 text-muted-foreground" />}
                          level={1}
                          onClick={() => handleViewClick(view.name)}
                        />
                      </div>
                    </ContextMenuTrigger>
                    <ContextMenuContent className="w-48">
                      <ContextMenuItem onSelect={() => handleViewClick(view.name)} className="gap-2">
                        <Table className="h-4 w-4" />
                        View Data
                      </ContextMenuItem>
                      <ContextMenuItem onSelect={() => handleCopyViewDdl(view.name)} className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copy DDL
                      </ContextMenuItem>
                      <ContextMenuSeparator />
                      <ContextMenuItem
                        onSelect={() => setViewToDrop(view.name)}
                        className="gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        Drop View
                      </ContextMenuItem>
                    </ContextMenuContent>
                  </ContextMenu>
                ))
              ) : viewsByConnection[connection.id] ? (
                <div className="ml-6 py-2 text-xs text-muted-foreground">No views found</div>
              ) : (
                <div className="ml-6 flex items-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading views...</span>
                </div>
              )}
            </TreeItem>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="w-48">
          <ContextMenuItem onSelect={loadConnectionViews} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isLoadingViews && "animate-spin")} />
            Refresh
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>

      {/* Drop View Confirmation Dialog */}
      <AlertDialog open={!!viewToDrop} onOpenChange={(open) => !open && setViewToDrop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Drop View</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to drop the view "{viewToDrop}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmViewDrop}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Drop View
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
