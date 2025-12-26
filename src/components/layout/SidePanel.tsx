import { useState, useMemo, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Save, Trash2, RotateCcw, Table, Code, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";
import { 
  Button, 
  Input, 
  ScrollArea, 
  Label,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui";
import { useUIStore, useCRUDStore } from "@/stores";
import { useCRUD } from "@/hooks";
import { DiffViewer } from "@/components/data-grid/DiffViewer";

interface FieldEditorProps {
  name: string;
  value: unknown;
  type: string;
  nullable: boolean;
  onChange: (value: unknown) => void;
}

function FieldEditor({ name, value, type, nullable, onChange }: FieldEditorProps) {
  // Use local state for immediate input feedback, synced with prop value
  const [localValue, setLocalValue] = useState(value);
  const isNull = localValue === null;
  const stringValue = isNull ? "" : String(localValue);

  // Sync local state with prop value when it changes externally
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleChange = (newValue: unknown) => {
    setLocalValue(newValue);
    onChange(newValue);
  };

  return (
    <div className="space-y-2 p-3 rounded-lg hover:bg-muted/30 transition-colors">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">{name}</Label>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
          {type}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isNull}
          className={cn(
            "font-mono text-sm",
            isNull && "bg-muted/50 text-muted-foreground"
          )}
          placeholder={isNull ? "NULL" : `Enter ${name}`}
        />
        {nullable && (
          <Button
            variant={isNull ? "default" : "outline"}
            size="sm"
            className={cn(
              "shrink-0 text-xs font-mono h-10 px-3",
              isNull && "bg-muted-foreground/20 text-foreground hover:bg-muted-foreground/30"
            )}
            onClick={() => handleChange(isNull ? "" : null)}
          >
            NULL
          </Button>
        )}
      </div>
    </div>
  );
}

export function SidePanel() {
  const { sidePanelOpen, sidePanelWidth, toggleSidePanel } = useUIStore();
  const { 
    selectedRows,
    pendingChanges, 
    addPendingChange, 
    removePendingChange,
    clearPendingChanges,
    commitMode,
    setCommitMode
  } = useCRUDStore();
  const { commitChanges } = useCRUD();
  
  const [activePanel, setActivePanel] = useState("fields");
  const [currentRowIndex, setCurrentRowIndex] = useState(0);
  const [viewMode, setViewMode] = useState<"sql" | "diff">("sql");

  // Get the current selected row with full context (multi-table safe)
  const currentSelection = selectedRows[currentRowIndex] || selectedRows[0];
  const selectedRowId = currentSelection?.rowId;
  const rowData = currentSelection?.rowData || null;
  const rowTableName = currentSelection?.tableName || "unknown";
  const rowColumns = currentSelection?.columns || [];
  
  const change = selectedRowId ? pendingChanges[selectedRowId] : null;

  // Reset index if it goes out of bounds
  // Use useMemo to avoid setState during render
  useMemo(() => {
    if (currentRowIndex >= selectedRows.length && selectedRows.length > 0) {
      setCurrentRowIndex(0);
    }
  }, [currentRowIndex, selectedRows.length]);

  if (!sidePanelOpen) {
    return null;
  }

  const fields = rowColumns.map(col => ({
    name: col.name,
    type: col.dataType,
    nullable: col.nullable,
    value: change?.newData?.[col.name] ?? rowData?.[col.name]
  }));

  const handleFieldChange = (name: string, newValue: unknown) => {
    if (!rowData || !rowColumns.length) return;

    // Build primaryKey with sorted keys to match generateRowId
    const pkColumns = rowColumns.filter(c => c.isPrimaryKey).sort((a, b) => a.name.localeCompare(b.name));
    const primaryKey: Record<string, unknown> = {};
    
    if (pkColumns.length > 0) {
      // Use primary key columns
      pkColumns.forEach(c => {
        primaryKey[c.name] = rowData[c.name];
      });
    } else {
      // Fallback: use all columns (matching generateRowId behavior)
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

  const pendingChangesList = Object.values(pendingChanges);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-l border-border bg-card",
        "animate-slide-up"
      )}
      style={{ width: sidePanelWidth }}
    >
      {/* Header */}
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
            {pendingChangesList.length > 0 && activePanel === "sql" ? (
              <Code className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Table className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
          <div>
            <span className="text-sm font-medium">
              {pendingChangesList.length > 0 && activePanel === "sql" 
                ? "Pending Changes"
                : selectedRows.length > 1 
                  ? `${selectedRows.length} Rows Selected`
                  : selectedRowId ? "Edit Row" : "No Row Selected"}
            </span>
            {selectedRowId && selectedRows.length === 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground truncate max-w-[150px]">
                  {rowTableName}
                </span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {pendingChangesList.length > 0 && (
            <div className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold mr-2">
              {pendingChangesList.length}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleSidePanel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Tabs value={activePanel} onValueChange={setActivePanel} className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 py-2 border-b border-border bg-muted/20">
          <TabsList className="grid w-full grid-cols-2 h-8">
            <TabsTrigger value="fields" className="text-xs gap-1.5">
              <Table className="h-3.5 w-3.5" />
              Fields
            </TabsTrigger>
            <TabsTrigger value="sql" className="text-xs gap-1.5">
              <Code className="h-3.5 w-3.5" />
              SQL Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="fields" className="flex-1 m-0 overflow-hidden">
          {selectedRowId && rowData ? (
            <div className="flex flex-col h-full">
              {/* Table name indicator */}
              {rowTableName && (
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30">
                  <Table className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs font-mono text-muted-foreground">{rowTableName}</span>
                </div>
              )}
              
              {/* Navigation for multiple selection */}
              {selectedRows.length > 1 && (
                <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/10">
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
                </div>
              )}
              
              <ScrollArea className="flex-1">
                <div className="p-3 space-y-1">
                  {fields.map((field) => (
                    <FieldEditor
                      key={field.name}
                      name={field.name}
                      value={field.value}
                      type={field.type}
                      nullable={field.nullable}
                      onChange={(newValue) => handleFieldChange(field.name, newValue)}
                    />
                  ))}
                </div>
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <Table className="h-8 w-8 opacity-20" />
              </div>
              <p className="text-sm">
                {selectedRowId 
                  ? "Row not found in current table. Select a row from the active table."
                  : "Select a row in the table to edit its fields"}
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sql" className="flex-1 m-0 overflow-hidden flex flex-col">
          {/* View mode toggle */}
          {pendingChangesList.length > 0 && (
            <div className="px-4 py-2 border-b border-border bg-muted/20">
              <div className="flex bg-muted rounded p-0.5 border border-border w-fit">
                <Button
                  variant={viewMode === "sql" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-3 text-[10px] gap-1.5"
                  onClick={() => setViewMode("sql")}
                >
                  <Code className="h-3 w-3" />
                  SQL
                </Button>
                <Button
                  variant={viewMode === "diff" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-3 text-[10px] gap-1.5"
                  onClick={() => setViewMode("diff")}
                >
                  <GitCommit className="h-3 w-3" />
                  Diff
                </Button>
              </div>
            </div>
          )}

          <ScrollArea className="h-full">
            <div className="p-4">
              {viewMode === "sql" ? (
                <div className="font-mono text-xs space-y-4">
                  {pendingChangesList.length > 0 ? (
                    pendingChangesList.map((change, idx) => (
                      <div key={change.id} className="space-y-2 pb-4 border-b border-border last:border-0">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">
                          <span>Change #{idx + 1}: {change.type}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-4 w-4 hover:text-destructive"
                            onClick={() => removePendingChange(JSON.stringify(change.primaryKey))}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="bg-muted/50 p-3 rounded border border-border overflow-x-auto">
                          <pre className="text-foreground">
                            {change.type === "update" && (
                              <>
                                <span className="text-blue-500">UPDATE</span> {change.tableName} <br />
                                <span className="text-blue-500">SET</span> {
                                  Object.entries(change.newData || {}).map(([key, val], i, arr) => (
                                    <span key={key}>
                                      {key} = <span className="text-amber-500">{typeof val === 'string' ? `'${val}'` : String(val)}</span>
                                      {i < arr.length - 1 ? ", " : ""}
                                    </span>
                                  ))
                                } <br />
                                <span className="text-blue-500">WHERE</span> {
                                  Object.entries(change.primaryKey).map(([key, val], i, arr) => (
                                    <span key={key}>
                                      {key} = <span className="text-amber-500">{typeof val === 'string' ? `'${val}'` : String(val)}</span>
                                      {i < arr.length - 1 ? " AND " : ""}
                                    </span>
                                  ))
                                };
                              </>
                            )}
                            {change.type === "delete" && (
                              <>
                                <span className="text-destructive">DELETE FROM</span> {change.tableName} <br />
                                <span className="text-blue-500">WHERE</span> {
                                  Object.entries(change.primaryKey).map(([key, val], i, arr) => (
                                    <span key={key}>
                                      {key} = <span className="text-amber-500">{typeof val === 'string' ? `'${val}'` : String(val)}</span>
                                      {i < arr.length - 1 ? " AND " : ""}
                                    </span>
                                  ))
                                };
                              </>
                            )}
                          </pre>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center mt-20">
                      <div className="bg-muted p-4 rounded-full mb-4">
                        <Code className="h-8 w-8 opacity-20" />
                      </div>
                      <p className="text-sm">No pending changes to display</p>
                    </div>
                  )}
                </div>
              ) : (
                <DiffViewer changes={pendingChangesList} onRemoveChange={removePendingChange} />
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="border-t border-border p-3 bg-muted/30 space-y-3">
        <div className="flex items-center justify-between px-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Commit Mode</Label>
          <div className="flex bg-muted rounded p-0.5 border border-border">
            <Button 
              variant={commitMode === "staged" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-6 px-2 text-[10px]"
              onClick={() => setCommitMode("staged")}
            >
              Staged
            </Button>
            <Button 
              variant={commitMode === "immediate" ? "secondary" : "ghost"} 
              size="sm" 
              className="h-6 px-2 text-[10px]"
              onClick={() => setCommitMode("immediate")}
            >
              Immediate
            </Button>
          </div>
        </div>
        
        <div className="flex items-center justify-between gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1 text-xs gap-1.5"
            onClick={clearPendingChanges}
            disabled={pendingChangesList.length === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear All
          </Button>
          <Button 
            size="sm" 
            className="flex-1 text-xs gap-1.5 bg-primary"
            disabled={pendingChangesList.length === 0}
            onClick={commitChanges}
          >
            <Save className="h-3.5 w-3.5" />
            Commit ({pendingChangesList.length})
          </Button>
        </div>
      </div>
    </aside>
  );
}

