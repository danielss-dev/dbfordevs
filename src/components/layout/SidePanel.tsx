import { useState, useMemo, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Save, Trash2, RotateCcw, Table, Code, GitCommit, Eye, AlertCircle, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Button,
  Input,
  Label,
  ResizeHandle,
} from "@/components/ui";
import { useUIStore, useCRUDStore, useQueryStore, usePreviewStore } from "@/stores";
import { useCRUD, useDatabase } from "@/hooks";
import { DiffViewer } from "@/components/data-grid/DiffViewer";
import { DdlPreviewView } from "@/components/preview/DdlPreviewView";
import { DmlPreviewView } from "@/components/preview/DmlPreviewView";

interface FieldEditorProps {
  name: string;
  value: unknown;
  type: string;
  nullable: boolean;
  onChange: (value: unknown) => void;
}

function FieldEditor({ name, value, type, nullable, onChange }: FieldEditorProps) {
  const [localValue, setLocalValue] = useState(value);
  const isNull = localValue === null;
  const stringValue = isNull ? "" : String(localValue);

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

// Fields Panel - Row Editor
function FieldsPanel() {
  const { selectedRows, pendingChanges, addPendingChange } = useCRUDStore();
  const [currentRowIndex, setCurrentRowIndex] = useState(0);

  const currentSelection = selectedRows[currentRowIndex] || selectedRows[0];
  const selectedRowId = currentSelection?.rowId;
  const rowData = currentSelection?.rowData || null;
  const rowTableName = currentSelection?.tableName || "unknown";
  const rowColumns = currentSelection?.columns || [];
  const change = selectedRowId ? pendingChanges[selectedRowId] : null;

  useMemo(() => {
    if (currentRowIndex >= selectedRows.length && selectedRows.length > 0) {
      setCurrentRowIndex(0);
    }
  }, [currentRowIndex, selectedRows.length]);

  const fields = rowColumns.map(col => ({
    name: col.name,
    type: col.dataType,
    nullable: col.nullable,
    value: change?.newData?.[col.name] ?? rowData?.[col.name]
  }));

  const handleFieldChange = (name: string, newValue: unknown) => {
    if (!rowData || !rowColumns.length) return;

    const pkColumns = rowColumns.filter(c => c.isPrimaryKey).sort((a, b) => a.name.localeCompare(b.name));
    const primaryKey: Record<string, unknown> = {};

    if (pkColumns.length > 0) {
      pkColumns.forEach(c => {
        primaryKey[c.name] = rowData[c.name];
      });
    } else {
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

  if (!selectedRowId || !rowData) {
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
    </div>
  );
}

// Changes Preview Panel
function ChangesPreviewPanel() {
  const {
    pendingChanges,
    removePendingChange,
    clearPendingChanges,
    commitMode,
    setCommitMode
  } = useCRUDStore();
  const { commitChanges } = useCRUD();
  const [viewMode, setViewMode] = useState<"sql" | "diff">("sql");

  const pendingChangesList = Object.values(pendingChanges);

  return (
    <div className="flex flex-col h-full">
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
                <div className="flex flex-col items-center justify-center text-muted-foreground p-8 text-center mt-8">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 bg-success/5 rounded-full blur-2xl scale-150" />
                    <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-sm">
                      <Code className="h-10 w-10 text-muted-foreground/30" />
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground/60 mb-2">No pending changes</p>
                  <p className="text-xs text-muted-foreground/60 max-w-[200px]">
                    Edit cell values to see changes here
                  </p>
                </div>
              )}
            </div>
          ) : (
            <DiffViewer changes={pendingChangesList} onRemoveChange={removePendingChange} />
          )}
        </div>
      </div>

      {/* Actions Footer */}
      <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 space-y-3 shrink-0">
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
    </div>
  );
}

// Query Preview Panel
function QueryPreviewPanel() {
  const { isPreviewLoading, previewResult, previewSql, previewConnectionId, closePreview } = usePreviewStore();
  const { activeTabId } = useQueryStore();
  const { executeQuery } = useDatabase();

  const hasDdlStatements = useMemo(() => {
    return previewResult?.statements.some((s) => s.statementType === "ddl") ?? false;
  }, [previewResult]);

  const hasDmlStatements = useMemo(() => {
    return previewResult?.statements.some((s) => s.statementType === "dml") ?? false;
  }, [previewResult]);

  const handleApply = async () => {
    if (!previewSql || !previewConnectionId || !activeTabId) return;

    await executeQuery(
      {
        connectionId: previewConnectionId,
        sql: previewSql,
        limit: undefined,
        offset: undefined,
      },
      activeTabId
    );
    closePreview();
  };

  if (!previewResult && !isPreviewLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-primary/5 rounded-full blur-2xl scale-150" />
          <div className="relative bg-gradient-to-br from-muted/80 to-muted/40 p-5 rounded-2xl border border-border/50 shadow-sm">
            <Eye className="h-10 w-10 text-muted-foreground/30" />
          </div>
        </div>
        <p className="text-sm font-medium text-foreground/60 mb-2">No preview</p>
        <p className="text-xs text-muted-foreground/60 max-w-[200px]">
          Click "Preview Changes" in a query tab to see DDL/DML preview
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          {isPreviewLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <span className="text-sm text-muted-foreground">Analyzing query...</span>
            </div>
          ) : previewResult?.error ? (
            <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
              <span className="text-sm text-destructive">{previewResult.error}</span>
            </div>
          ) : previewResult ? (
            <div className="space-y-6">
              {previewResult.warning && (
                <div className="flex items-start gap-3 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <span className="text-sm text-amber-600 dark:text-amber-400">
                    {previewResult.warning}
                  </span>
                </div>
              )}
              {previewResult.success && previewResult.statements.length === 0 && !previewResult.warning && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <p className="text-sm font-medium text-foreground/60 mb-2">No changes to preview</p>
                  <p className="text-xs text-muted-foreground/60 max-w-[200px] text-center">
                    The query doesn't contain any DDL or DML statements
                  </p>
                </div>
              )}

              {hasDdlStatements && (
                <DdlPreviewView
                  statements={previewResult.statements.filter((s) => s.statementType === "ddl")}
                />
              )}

              {hasDmlStatements && (
                <DmlPreviewView
                  statements={previewResult.statements.filter((s) => s.statementType === "dml")}
                />
              )}

              {previewResult.executionTimeMs > 0 && (
                <div className="text-xs text-muted-foreground text-right pt-2">
                  Preview completed in {previewResult.executionTimeMs}ms
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Actions Footer */}
      {(previewResult || isPreviewLoading) && (
        <div className="border-t border-border p-3 bg-gradient-to-t from-muted/40 to-muted/20 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-xs gap-1.5 h-9"
              onClick={closePreview}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 text-xs gap-1.5 h-9 font-medium shadow-sm"
              onClick={handleApply}
              disabled={isPreviewLoading || !previewResult?.success}
            >
              <Check className="h-3.5 w-3.5" />
              Apply Changes
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SidePanel() {
  const { sidePanelOpen, sidePanelWidth, setSidePanelWidth, rightPanelTab, setRightPanelTab } = useUIStore();
  const { selectedRows, pendingChanges } = useCRUDStore();

  const pendingChangesList = Object.values(pendingChanges);

  // Get panel title based on active tab
  const getPanelTitle = () => {
    switch (rightPanelTab) {
      case "fields":
        return selectedRows.length > 1
          ? `${selectedRows.length} Rows Selected`
          : selectedRows.length === 1
            ? "Edit Row"
            : "Fields";
      case "changes":
        return pendingChangesList.length > 0
          ? `Pending Changes (${pendingChangesList.length})`
          : "Changes Preview";
      case "preview":
        return "Query Preview";
      default:
        return "Panel";
    }
  };

  // Get panel icon based on active tab
  const getPanelIcon = () => {
    switch (rightPanelTab) {
      case "fields":
        return <Table className="h-4 w-4" />;
      case "changes":
        return <Code className="h-4 w-4" />;
      case "preview":
        return <Eye className="h-4 w-4" />;
      default:
        return <Table className="h-4 w-4" />;
    }
  };

  if (!sidePanelOpen || !rightPanelTab) {
    return null;
  }

  return (
    <aside
      className={cn(
        "relative flex h-full flex-col border-l border-border bg-card",
        "animate-slide-up"
      )}
      style={{ width: sidePanelWidth }}
    >
      {/* Resize Handle */}
      <ResizeHandle
        direction="left"
        currentWidth={sidePanelWidth}
        onResize={setSidePanelWidth}
        minWidth={280}
        maxWidth={600}
      />

      {/* Header */}
      <div className="flex h-10 items-center justify-between border-b border-border px-3 bg-muted/30 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 rounded text-primary">
            {getPanelIcon()}
          </div>
          <span className="text-sm font-medium">{getPanelTitle()}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 hover:bg-destructive/10 hover:text-destructive"
          onClick={() => setRightPanelTab(null)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {rightPanelTab === "fields" && <FieldsPanel />}
        {rightPanelTab === "changes" && <ChangesPreviewPanel />}
        {rightPanelTab === "preview" && <QueryPreviewPanel />}
      </div>
    </aside>
  );
}
