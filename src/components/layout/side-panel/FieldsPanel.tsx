import { useState, useMemo } from "react";
import { X, ChevronLeft, ChevronRight, Table, Plus } from "lucide-react";
import { Button, Badge } from "@/components/ui";
import { useCRUDStore, useQueryStore, useSchemaStore } from "@/stores";
import { FieldEditor, type ForeignKeyRef } from "./FieldEditor";
import { selectActiveTab } from "./shared";

// Fields Panel - Row Editor
export function FieldsPanel() {
  const {
    selectedRows,
    pendingChanges,
    addPendingChange,
    creatingNewRow,
    updateCreatingRowField,
    cancelCreatingRow,
    saveCreatingRow,
    removeSelectedRow,
    clearSelection,
  } = useCRUDStore();
  const { getSchema } = useSchemaStore();
  const activeTab = useQueryStore(selectActiveTab);
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  // Check if we're in create mode
  const isCreatingNew = creatingNewRow !== null;

  const currentSelection = selectedRows[currentRowIndex] || selectedRows[0];
  const selectedRowId = currentSelection?.rowId;
  const rowData = isCreatingNew ? creatingNewRow.data : (currentSelection?.rowData || null);
  const rowTableName = isCreatingNew ? creatingNewRow.tableName : (currentSelection?.tableName || "unknown");
  const rowColumns = isCreatingNew ? creatingNewRow.columns : (currentSelection?.columns || []);
  const change = selectedRowId ? pendingChanges[selectedRowId] : null;

  // Get cached schema for better primary key detection
  const connectionId = activeTab?.connectionId;
  const cachedSchema = connectionId ? getSchema(connectionId, rowTableName) : null;

  // Merge columns with cached schema to get accurate isPrimaryKey and dataType
  // The cached schema includes type metadata like IDENTITY/AUTO_INCREMENT markers
  const mergedColumns = useMemo(() => {
    if (!cachedSchema?.columns) return rowColumns;

    // Build maps from cached schema for quick lookup
    const pkSet = new Set(cachedSchema.primaryKeys || []);
    const schemaColMap = new Map(cachedSchema.columns.map(col => [col.name, col]));
    cachedSchema.columns.forEach(col => {
      if (col.isPrimaryKey) pkSet.add(col.name);
    });

    // Merge isPrimaryKey and dataType from cached schema into rowColumns
    return rowColumns.map(col => {
      const schemaCol = schemaColMap.get(col.name);
      return {
        ...col,
        // Use schema dataType if available (includes IDENTITY/AUTO_INCREMENT markers)
        dataType: schemaCol?.dataType || col.dataType,
        isPrimaryKey: col.isPrimaryKey || pkSet.has(col.name),
      };
    });
  }, [rowColumns, cachedSchema]);

  useMemo(() => {
    if (currentRowIndex >= selectedRows.length && selectedRows.length > 0) {
      setCurrentRowIndex(0);
    }
  }, [currentRowIndex, selectedRows.length]);

  // Helper to detect auto-increment columns
  const isAutoIncrementColumn = (dataType: string) => {
    const type = dataType.toLowerCase();
    return (
      type.includes("serial") || // PostgreSQL: serial, bigserial, smallserial
      type.includes("identity") || // MSSQL/Oracle: identity columns
      type.includes("auto_increment") || // MySQL: AUTO_INCREMENT columns
      type.includes("autoincrement") // SQLite: INTEGER PRIMARY KEY AUTOINCREMENT
    );
  };

  // Build FK lookup map from cached schema
  const fkMap = useMemo(() => {
    const map = new Map<string, ForeignKeyRef>();
    if (cachedSchema?.foreignKeys) {
      cachedSchema.foreignKeys.forEach(fk => {
        map.set(fk.column, {
          referencesTable: fk.referencesTable,
          referencesColumn: fk.referencesColumn,
        });
      });
    }
    return map;
  }, [cachedSchema]);

  const fields = mergedColumns.map(col => {
    const isAutoIncrement = isAutoIncrementColumn(col.dataType);
    const foreignKey = fkMap.get(col.name);
    return {
      name: col.name,
      type: col.dataType,
      nullable: col.nullable,
      isPrimaryKey: col.isPrimaryKey,
      isAutoIncrement,
      foreignKey,
      // In create mode, use the creatingNewRow data; otherwise use pending change or original row data
      value: isCreatingNew
        ? creatingNewRow.data[col.name]
        : (change?.newData?.[col.name] ?? rowData?.[col.name])
    };
  });

  const handleFieldChange = (name: string, newValue: unknown) => {
    // In create mode, update the creatingNewRow state
    if (isCreatingNew) {
      updateCreatingRowField(name, newValue);
      return;
    }

    if (!rowData || !mergedColumns.length) return;

    // Use merged columns with accurate isPrimaryKey
    const pkColumns = mergedColumns.filter(c => c.isPrimaryKey).sort((a, b) => a.name.localeCompare(b.name));
    const primaryKey: Record<string, unknown> = {};

    if (pkColumns.length > 0) {
      pkColumns.forEach(c => {
        primaryKey[c.name] = rowData[c.name];
      });
    } else {
      // Fallback: use all columns (but this should rarely happen now)
      const sortedKeys = Object.keys(rowData).sort();
      sortedKeys.forEach(k => {
        primaryKey[k] = rowData[k];
      });
    }

    addPendingChange({
      id: crypto.randomUUID(),
      tableName: rowTableName,
      type: "update",
      originalData: rowData,
      newData: {
        ...(change?.newData || {}),
        [name]: newValue,
      },
      primaryKey,
    });
  };

  // Show empty state only when not creating and no row selected
  if (!isCreatingNew && (!selectedRowId || !rowData)) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-sm">
            <Table className="h-10 w-10 text-muted-foreground/30" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground/60 mb-2">No row selected</p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
          Click on a row number to select and edit fields
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table name indicator */}
      {rowTableName && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
          <Table className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-mono text-muted-foreground">{rowTableName}</span>
          {isCreatingNew && (
            <Badge variant="secondary" className="text-[10px] h-5 bg-success/15 text-success border-success/30">
              New Row
            </Badge>
          )}
        </div>
      )}

      {/* Navigation for selection (only when not creating) */}
      {!isCreatingNew && selectedRows.length > 0 && (
        <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/10 shrink-0">
          {selectedRows.length > 1 ? (
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentRowIndex(prev => Math.max(0, prev - 1))}
                disabled={currentRowIndex === 0}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs font-medium px-2">{currentRowIndex + 1} of {selectedRows.length}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setCurrentRowIndex(prev => Math.min(selectedRows.length - 1, prev + 1))}
                disabled={currentRowIndex === selectedRows.length - 1}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">1 row selected</span>
          )}
          {/* Deselect buttons */}
          <div className="flex items-center gap-1">
            {selectedRows.length > 1 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const currentRow = selectedRows[currentRowIndex];
                  if (currentRow) {
                    removeSelectedRow(currentRow.rowId);
                    if (currentRowIndex >= selectedRows.length - 1) {
                      setCurrentRowIndex(Math.max(0, currentRowIndex - 1));
                    }
                  }
                }}
                title="Remove current row from selection"
              >
                Remove
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={clearSelection}
              title="Clear all selection"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="p-3 space-y-1">
          {fields.map((field) => (
            <FieldEditor
              key={field.name}
              name={field.name}
              value={field.value}
              type={field.type}
              nullable={field.nullable}
              // In create mode, primary keys are editable unless auto-increment
              isPrimaryKey={isCreatingNew ? false : field.isPrimaryKey}
              isAutoIncrement={field.isAutoIncrement}
              isCreatingNew={isCreatingNew}
              foreignKey={field.foreignKey}
              connectionId={connectionId}
              onChange={(newValue) => handleFieldChange(field.name, newValue)}
            />
          ))}
        </div>
      </div>

      {/* Save/Cancel buttons for create mode */}
      {isCreatingNew && (
        <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5 h-9"
              onClick={cancelCreatingRow}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gap-1.5 h-9 font-medium shadow-sm bg-success hover:bg-success/90 text-success-foreground"
              onClick={saveCreatingRow}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Row
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
