import { useState, useMemo, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Save, Trash2, RotateCcw, Table, Code, GitCommit } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
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
    <div className="group space-y-2 p-3 rounded-lg hover:bg-muted/40 transition-all border border-transparent hover:border-border/50">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-sm font-medium text-foreground/90">{name}</Label>
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-mono bg-muted/70 px-1.5 py-0.5 rounded border border-border/30">
          {type}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={stringValue}
          onChange={(e) => handleChange(e.target.value)}
          disabled={isNull}
          className={cn(
            "font-mono text-sm h-9 transition-all",
            isNull ? "bg-muted/50 text-muted-foreground italic" : "bg-background/50 focus:bg-background"
          )}
          placeholder={isNull ? "NULL" : `Enter ${name}`}
        />
        {nullable && (
          <Button
            variant={isNull ? "secondary" : "outline"}
            size="sm"
            className={cn(
              "shrink-0 text-[10px] font-mono h-9 px-3 uppercase tracking-wider transition-all",
              isNull
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                : "hover:bg-muted/80"
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
      <div className="flex h-12 items-center justify-between border-b border-border px-4 bg-gradient-to-r from-muted/30 to-transparent">
        <div className="flex items-center gap-3">
          <div className={cn(
            "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
            pendingChangesList.length > 0 ? "bg-primary/10" : "bg-muted/50"
          )}>
            {pendingChangesList.length > 0 && activePanel === "sql" ? (
              <Code className="h-4 w-4 text-primary" />
            ) : (
              <Table className={cn("h-4 w-4", selectedRowId ? "text-primary" : "text-muted-foreground")} />
            )}
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold leading-tight">
              {pendingChangesList.length > 0 && activePanel === "sql"
                ? "Pending Changes"
                : selectedRows.length > 1
                  ? `${selectedRows.length} Rows Selected`
                  : selectedRowId ? "Edit Row" : "No Row Selected"}
            </span>
            {selectedRowId && selectedRows.length === 1 && (
              <span className="text-[11px] text-muted-foreground truncate max-w-[150px] leading-tight">
                {rowTableName}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {pendingChangesList.length > 0 && (
            <div className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-[10px] font-bold tabular-nums shadow-sm">
              {pendingChangesList.length} {pendingChangesList.length === 1 ? 'change' : 'changes'}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive" onClick={toggleSidePanel}>
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
              Changes Preview
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="fields" className="relative flex-1 m-0 overflow-hidden">
          <div className="absolute inset-0 flex flex-col">
            {selectedRowId && rowData ? (
              <>
                {/* Table name indicator */}
                {rowTableName && (
                  <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/30 shrink-0">
                    <Table className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-mono text-muted-foreground">{rowTableName}</span>
                  </div>
                )}

                {/* Navigation for multiple selection */}
                {selectedRows.length > 1 && (
                  <div className="flex items-center justify-between border-b border-border px-4 py-2 bg-muted/10 shrink-0">
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

                <div className="flex-1 overflow-auto">
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
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
                  <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-sm">
                    <Table className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                </div>
                <p className="text-sm font-medium text-foreground/60 mb-2">
                  {selectedRowId
                    ? "Row not found"
                    : "No row selected"}
                </p>
                <p className="text-xs text-muted-foreground/60 max-w-[200px]">
                  {selectedRowId
                    ? "Select a row from the active table to view and edit"
                    : "Click on a row number or use shift-click to select multiple rows"}
                </p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sql" className="relative flex-1 m-0 overflow-hidden">
          <div className="absolute inset-0 flex flex-col">
            {/* View mode toggle */}
            {pendingChangesList.length > 0 && (
              <div className="px-4 py-2 border-b border-border bg-muted/20 shrink-0">
                <div className="flex bg-muted rounded-md p-1 border border-border w-fit">
                  <Button
                    variant={viewMode === "sql" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 px-3 text-[11px] gap-1.5 font-medium transition-all",
                      viewMode === "sql" && "shadow-sm"
                    )}
                    onClick={() => setViewMode("sql")}
                  >
                    <Code className="h-3.5 w-3.5" />
                    SQL
                  </Button>
                  <Button
                    variant={viewMode === "diff" ? "default" : "ghost"}
                    size="sm"
                    className={cn(
                      "h-7 px-3 text-[11px] gap-1.5 font-medium transition-all",
                      viewMode === "diff" && "shadow-sm"
                    )}
                    onClick={() => setViewMode("diff")}
                  >
                    <GitCommit className="h-3.5 w-3.5" />
                    Diff
                  </Button>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
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
                          <div className="bg-muted/50 p-3 rounded border border-border">
                            <pre className="text-foreground whitespace-pre-wrap break-all">
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
                      <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center mt-16">
                        <div className="relative mb-6">
                          <div className="absolute inset-0 bg-success/5 rounded-full blur-2xl scale-150" />
                          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-sm">
                            <Code className="h-10 w-10 text-muted-foreground/30" />
                          </div>
                        </div>
                        <p className="text-sm font-medium text-foreground/60 mb-2">No pending changes</p>
                        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
                          Edit cell values or select rows to delete and preview changes here
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <DiffViewer changes={pendingChangesList} onRemoveChange={removePendingChange} />
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 space-y-3">
        <div className="flex items-center justify-between px-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/80 font-semibold">Commit Mode</Label>
          <div className="flex bg-background/50 rounded-md p-0.5 border border-border/50 shadow-sm">
            <Button
              variant={commitMode === "staged" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-6 px-3 text-[10px] font-medium transition-all",
                commitMode === "staged" && "shadow-sm"
              )}
              onClick={() => setCommitMode("staged")}
            >
              Staged
            </Button>
            <Button
              variant={commitMode === "immediate" ? "secondary" : "ghost"}
              size="sm"
              className={cn(
                "h-6 px-3 text-[10px] font-medium transition-all",
                commitMode === "immediate" && "shadow-sm"
              )}
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
            className="flex-1 text-xs gap-1.5 h-9 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            onClick={clearPendingChanges}
            disabled={pendingChangesList.length === 0}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear All
          </Button>
          <Button
            size="sm"
            className={cn(
              "flex-1 text-xs gap-1.5 h-9 font-medium shadow-sm transition-all",
              pendingChangesList.length > 0
                ? "bg-primary hover:bg-primary/90"
                : "bg-muted text-muted-foreground"
            )}
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

