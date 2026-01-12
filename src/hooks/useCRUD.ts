import { useCallback } from "react";
import { useCRUDStore, useQueryStore, useSchemaStore, selectActiveTab } from "@/stores";
import { useDatabase } from "@/hooks";
import { useToast } from "@/hooks/useToast";
import type { PendingChange } from "@/types";

export function useCRUD() {
  const {
    pendingChanges,
    removePendingChange,
  } = useCRUDStore();
  const { getSchema } = useSchemaStore();
  const { updateRow, deleteRow, insertRow } = useDatabase();
  const activeTab = useQueryStore(selectActiveTab);
  const { toast } = useToast();

  // Helper to recalculate primary key from current schema
  // This ensures we use the correct primary key columns even if the change
  // was created before the schema was loaded
  const getActualPrimaryKey = useCallback((change: PendingChange, connectionId: string): Record<string, unknown> => {
    const cachedSchema = getSchema(connectionId, change.tableName);

    if (!cachedSchema?.columns || !change.originalData) {
      // No schema available, use the stored primary key as-is
      return change.primaryKey;
    }

    // Build set of primary key column names from schema
    const pkSet = new Set(cachedSchema.primaryKeys || []);
    cachedSchema.columns.forEach(col => {
      if (col.isPrimaryKey) pkSet.add(col.name);
    });

    // If schema has primary key info, recalculate from original data
    if (pkSet.size > 0) {
      const actualPK: Record<string, unknown> = {};
      pkSet.forEach(colName => {
        actualPK[colName] = change.originalData![colName];
      });
      return actualPK;
    }

    // No primary key defined in schema, use stored primary key
    return change.primaryKey;
  }, [getSchema]);

  const commitChanges = useCallback(async () => {
    if (!activeTab || !activeTab.connectionId) return;

    const changes = Object.values(pendingChanges);
    if (changes.length === 0) return;

    let successCount = 0;
    let errorCount = 0;

    for (const change of changes) {
      try {
        let result = null;
        // Recalculate primary key from current schema for accurate WHERE clause
        const actualPK = getActualPrimaryKey(change, activeTab.connectionId);

        if (change.type === "update") {
          result = await updateRow(
            activeTab.connectionId,
            change.tableName,
            actualPK,
            change.newData || {}
          );
        } else if (change.type === "delete") {
          result = await deleteRow(
            activeTab.connectionId,
            change.tableName,
            actualPK
          );
        } else if (change.type === "insert") {
          // Filter out internal marker fields
          const insertData = { ...(change.newData || {}) };
          delete (insertData as Record<string, unknown>).__pending_insert;
          delete (insertData as Record<string, unknown>).__temp_pk;

          result = await insertRow(
            activeTab.connectionId,
            change.tableName,
            insertData
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
  }, [activeTab, pendingChanges, updateRow, deleteRow, insertRow, removePendingChange, toast, getActualPrimaryKey]);

  return {
    commitChanges,
  };
}

