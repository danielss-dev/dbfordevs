import { useMemo } from "react";
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

function DiffItem({ change, idx, onRemove }: { change: PendingChange; idx: number; onRemove: () => void }) {
  const diffFields = useMemo(() => {
    const fields: DiffField[] = [];
    const { type, originalData, newData } = change;

    if (type === "delete" && originalData) {
      // DELETE: show all fields as removed
      Object.entries(originalData).forEach(([name, value]) => {
        fields.push({ name, status: "removed", oldValue: value });
      });
    } else if (type === "insert" && newData) {
      // INSERT: show all fields as added
      Object.entries(newData).forEach(([name, value]) => {
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

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "update": return "text-blue-500";
      case "delete": return "text-destructive";
      case "insert": return "text-success";
      default: return "text-muted-foreground";
    }
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return "NULL";
    if (typeof value === "string") return `"${value}"`;
    return String(value);
  };

  return (
    <div className="space-y-2 pb-4 border-b border-border last:border-0">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">
        <span>Change #{idx + 1}</span>
        <div className="flex items-center gap-2">
          <span className={`font-bold ${getTypeLabel(change.type)}`}>{change.type}</span>
          <button
            onClick={onRemove}
            className="hover:text-destructive transition-colors"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="bg-muted/30 rounded-lg border border-border overflow-hidden">
        {/* Table name header */}
        <div className="px-3 py-1.5 bg-muted/50 border-b border-border flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
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
                className={`flex gap-2 px-2 py-0.5 rounded ${
                  field.status === "added" ? "bg-success/10" :
                  field.status === "removed" ? "bg-destructive/10" :
                  "bg-transparent"
                }`}
              >
                <span className={`
                  w-6 flex items-center justify-center font-bold shrink-0
                  ${field.status === "added" ? "text-success" :
                    field.status === "removed" ? "text-destructive" :
                    "text-muted-foreground/40"}
                `}>
                  {field.status === "added" ? "+" :
                   field.status === "removed" ? "-" :
                   field.status === "changed" ? "~" :
                   " "}
                </span>
                <span className="shrink-0 text-muted-foreground/60 min-w-0 truncate">
                  {field.name}:
                </span>
                <span className={`
                  truncate flex-1
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
    <div className="space-y-0">
      {changes.map((change, idx) => (
        <DiffItem
          key={change.id}
          change={change}
          idx={idx}
          onRemove={() => onRemoveChange(JSON.stringify(change.primaryKey))}
        />
      ))}
    </div>
  );
}
