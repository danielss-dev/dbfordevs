import { useCallback } from "react";
import { useCRUDStore, useQueryStore, selectActiveTab } from "@/stores";
import { useDatabase } from "@/hooks";
import { useToast } from "@/hooks/useToast";

export function useCRUD() {
  const { 
    pendingChanges, 
    clearPendingChanges, 
    removePendingChange,
    commitMode 
  } = useCRUDStore();
  const { updateRow, deleteRow, insertRow } = useDatabase();
  const activeTab = useQueryStore(selectActiveTab);
  const { toast } = useToast();

  const commitChanges = useCallback(async () => {
    if (!activeTab || !activeTab.connectionId) return;

    const changes = Object.values(pendingChanges);
    if (changes.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const change of changes) {
      try {
        let result = null;
        if (change.type === "update") {
          result = await updateRow(
            activeTab.connectionId,
            change.tableName,
            change.primaryKey,
            change.newData || {}
          );
        } else if (change.type === "delete") {
          result = await deleteRow(
            activeTab.connectionId,
            change.tableName,
            change.primaryKey
          );
        } else if (change.type === "insert") {
          result = await insertRow(
            activeTab.connectionId,
            change.tableName,
            change.newData || {}
          );
        }

        if (result) {
          successCount++;
          removePendingChange(JSON.stringify(change.primaryKey));
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error("Error committing change:", error);
        errorCount++;
      }
    }

    if (successCount > 0) {
      toast({
        title: "Changes committed",
        description: `Successfully applied ${successCount} change(s).${errorCount > 0 ? ` ${errorCount} failed.` : ""}`,
      });
      
      // We might want to refresh the table here, but TableViewerTab should handle it 
      // if we trigger a refresh or if it's watching something.
    } else if (errorCount > 0) {
      toast({
        title: "Commit failed",
        description: `Failed to apply ${errorCount} change(s).`,
        variant: "destructive",
      });
    }
  }, [activeTab, pendingChanges, updateRow, deleteRow, insertRow, removePendingChange, toast]);

  return {
    commitChanges,
  };
}

