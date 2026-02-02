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
    const errorMessages: string[] = [];

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

          // Get schema to identify auto-increment and nullable columns
          const cachedSchema = getSchema(activeTab.connectionId, change.tableName);

          if (cachedSchema?.columns) {
            const requiredColumns: string[] = [];

            for (const col of cachedSchema.columns) {
              const dataType = col.dataType.toLowerCase();
              const isAutoIncrement =
                dataType.includes("serial") || // PostgreSQL: serial, bigserial, smallserial
                dataType.includes("identity") || // MSSQL: IDENTITY columns
                dataType.includes("auto_increment") || // MySQL: AUTO_INCREMENT columns
                dataType.includes("autoincrement"); // SQLite: INTEGER PRIMARY KEY AUTOINCREMENT

              // Always remove auto-increment columns from insert
              if (isAutoIncrement) {
                delete insertData[col.name];
                continue;
              }

              // Track required (non-nullable, non-auto-increment) columns
              if (!col.nullable) {
                requiredColumns.push(col.name);
              }

              // Convert empty strings to null for nullable columns
              if (col.nullable && insertData[col.name] === "") {
                insertData[col.name] = null;
              }
            }

            // Validate required columns
            const missingColumns = requiredColumns.filter(
              colName => insertData[colName] === undefined || 
                         insertData[colName] === null || 
                         insertData[colName] === ""
            );

            if (missingColumns.length > 0) {
              throw new Error(
                `Required columns missing or empty: ${missingColumns.join(", ")}`
              );
            }
          }

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
        const errorMessage = error instanceof Error ? error.message : String(error);
        errorMessages.push(errorMessage);
      }
    }

    if (successCount > 0) {
      toast({
        title: "Changes committed",
        description: `Successfully applied ${successCount} change(s).${errorCount > 0 ? ` ${errorCount} failed.` : ""}`,
      });
    } else if (errorCount > 0) {
      const errorDetails = errorMessages.length > 0 
        ? ` ${errorMessages[0]}${errorMessages.length > 1 ? ` (+${errorMessages.length - 1} more)` : ""}`
        : "";
      toast({
        title: "Commit failed",
        description: `Failed to apply ${errorCount} change(s).${errorDetails}`,
        variant: "destructive",
      });
    }

    return successCount;
  }, [activeTab, pendingChanges, updateRow, deleteRow, insertRow, removePendingChange, toast, getActualPrimaryKey]);

  return {
    commitChanges,
  };
}

