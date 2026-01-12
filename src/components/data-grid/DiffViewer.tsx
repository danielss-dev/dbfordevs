import { useMemo } from "react";
import { Hash, Trash2, Plus, Pencil } from "lucide-react";
import type { PendingChange } from "@/types";

interface DiffViewerProps {
  changes: PendingChange[];
  onRemoveChange: (rowId: string) => void;
}

interface DiffField {
  name: string;
  type?: string;
  status: "added" | "removed" | "unchanged" | "changed";
  oldValue?: unknown;
  newValue?: unknown;
}

// Helper to get a readable row identifier from primary key
function getRowIdentifier(change: PendingChange): { label: string; value: string } {
  const pk = change.primaryKey;
  const pkEntries = Object.entries(pk).filter(([key]) => !key.startsWith("__"));

  if (pkEntries.length === 0) {
    return { label: "Row", value: "unknown" };
  }

  // If there's an 'id' column, prioritize it
  const idEntry = pkEntries.find(([key]) => key.toLowerCase() === "id");
  if (idEntry) {
    return { label: "id", value: String(idEntry[1]) };
  }

  // Otherwise use the first PK column
  const [key, value] = pkEntries[0];
  if (pkEntries.length === 1) {
    return { label: key, value: String(value) };
  }

  // Multiple PK columns - show all
  return {
    label: "Row",
    value: pkEntries.map(([k, v]) => `${k}=${v}`).join(", ")
  };
}

function DiffItem({ change, onRemove }: { change: PendingChange; onRemove: () => void }) {
  const diffFields = useMemo(() => {
    const fields: DiffField[] = [];
    const { type, originalData, newData } = change;

    if (type === "delete" && originalData) {
      // DELETE: show all fields as removed
      Object.entries(originalData).forEach(([name, value]) => {
        fields.push({ name, status: "removed", oldValue: value });
      });
    } else if (type === "insert" && newData) {
      // INSERT: show all fields as added (excluding internal markers)
      Object.entries(newData).forEach(([name, value]) => {
        // Skip internal markers
        if (name === "__pending_insert" || name === "__temp_pk") return;
        fields.push({ name, status: "added", newValue: value });
      });
    } else if (type === "update" && originalData && newData) {
      // UPDATE: only show changed fields
      // newData contains only the fields that were modified
      Object.entries(newData).forEach(([name, newValue]) => {
        const oldValue = originalData[name];

        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          // Field changed
          fields.push({ name, status: "changed", oldValue, newValue });
        }
      });
    }

    return fields;
  }, [change]);

  const getTypeStyles = (type: string) => {
    switch (type) {
      case "update": return { color: "text-blue-500", bg: "bg-blue-500/10", border: "border-blue-500/30" };
      case "delete": return { color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" };
      case "insert": return { color: "text-success", bg: "bg-success/10", border: "border-success/30" };
      default: return { color: "text-muted-foreground", bg: "bg-muted", border: "border-border" };
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "update": return <Pencil className="h-3 w-3" />;
      case "delete": return <Trash2 className="h-3 w-3" />;
      case "insert": return <Plus className="h-3 w-3" />;
      default: return null;
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "string") return `"${value}"`;
    return String(value);
  };

  const styles = getTypeStyles(change.type);
  const rowId = getRowIdentifier(change);

  return (
    <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Change header with type badge and row identifier */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          {/* Type badge */}
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${styles.color} ${styles.bg} border ${styles.border}`}>
            {getTypeIcon(change.type)}
            {change.type}
          </span>
          {/* Row identifier */}
          <div className="flex items-center gap-1.5 text-xs">
            <Hash className="h-3 w-3 text-muted-foreground/50" />
            <span className="text-muted-foreground/70">{rowId.label}:</span>
            <span className="font-mono font-semibold text-foreground">{rowId.value}</span>
          </div>
        </div>
        <button
          onClick={onRemove}
          className="p-1.5 rounded-md hover:bg-destructive/10 hover:text-destructive transition-colors"
          title="Remove change"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Table name subheader */}
      <div className="px-3 py-1.5 bg-muted/10 border-b border-border/50 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/80">
          {change.tableName}
        </span>
        {change.type === "update" && change.originalData && (
          <span className="text-[9px] text-muted-foreground/60">
            {diffFields.length} of {Object.keys(change.originalData).length} fields changed
          </span>
        )}
      </div>

        {/* Diff lines */}
        <div className="font-mono text-[11px] leading-relaxed p-2 space-y-0.5">
          {diffFields.length === 0 ? (
            <div className="text-muted-foreground/60 italic py-2">No fields to display</div>
          ) : (
            diffFields.map((field, fieldIdx) => (
              <div
                key={`${field.name}-${fieldIdx}`}
                className={`flex gap-2 px-2 py-1 rounded ${
                  field.status === "added" ? "bg-success/10" :
                  field.status === "removed" ? "bg-destructive/10" :
                  "bg-transparent"
                }`}
              >
                <span className={`
                  w-6 flex items-start justify-center font-bold shrink-0 pt-0.5
                  ${field.status === "added" ? "text-success" :
                    field.status === "removed" ? "text-destructive" :
                    "text-muted-foreground/40"}
                `}>
                  {field.status === "added" ? "+" :
                   field.status === "removed" ? "-" :
                   field.status === "changed" ? "~" :
                   " "}
                </span>
                <span className="shrink-0 text-muted-foreground/60">
                  {field.name}:
                </span>
                <span className={`
                  flex-1 break-all
                  ${field.status === "added" ? "text-success font-medium" :
                    field.status === "removed" ? "text-destructive line-through" :
                    field.status === "changed" ? "text-amber-500" :
                    "text-muted-foreground/70"}
                `}>
                  {field.status === "added" && formatValue(field.newValue)}
                  {field.status === "removed" && formatValue(field.oldValue)}
                  {field.status === "unchanged" && formatValue(field.oldValue)}
                  {field.status === "changed" && (
                    <>
                      <span className="text-destructive/70">{formatValue(field.oldValue)}</span>
                      <span className="text-muted-foreground/40 mx-1">→</span>
                      <span className="text-success/90">{formatValue(field.newValue)}</span>
                    </>
                  )}
                </span>
              </div>
            ))
          )}
        </div>
    </div>
  );
}

export function DiffViewer({ changes, onRemoveChange }: DiffViewerProps) {
  if (changes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8 text-center mt-20">
        <div className="bg-muted p-4 rounded-full mb-4">
          <svg className="h-8 w-8 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
          </svg>
        </div>
        <p className="text-sm">No pending changes to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {changes.map((change) => (
        <DiffItem
          key={change.id}
          change={change}
          onRemove={() => onRemoveChange(JSON.stringify(change.primaryKey))}
        />
      ))}
    </div>
  );
}
