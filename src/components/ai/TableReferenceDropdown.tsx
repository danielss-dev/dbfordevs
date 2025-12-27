/**
 * TableReferenceDropdown
 *
 * Autocomplete dropdown for @table and @table.column references in AI input.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Table, Columns, Check } from "lucide-react";
import { ScrollArea } from "@/components/ui";
import type { TableInfo } from "@/lib/ai/types";
import { cn } from "@/lib/utils";

interface TableReferenceDropdownProps {
  /** Filter text (what user typed after @) */
  filter: string;
  /** Available tables from context */
  tables: TableInfo[];
  /** Called when a table or column is selected */
  onSelect: (reference: string) => void;
  /** Called when dropdown should close */
  onClose: () => void;
  /** Current selection mode: "table" or "column" */
  mode?: "table" | "column";
  /** Selected table (when in column mode) */
  selectedTable?: string;
}

export function TableReferenceDropdown({
  filter,
  tables,
  onSelect,
  onClose,
  mode = "table",
  selectedTable,
}: TableReferenceDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Get items to display
  const items: Array<{ type: "table" | "column"; name: string; displayName: string; table?: string }> =
    mode === "table"
      ? tables
          .filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()))
          .map((t) => ({
            type: "table" as const,
            name: t.name,
            displayName: t.name,
          }))
      : selectedTable
      ? (
          tables.find((t) => t.name === selectedTable)?.columns || []
        )
          .filter((c) => c.name.toLowerCase().includes(filter.toLowerCase()))
          .map((c) => ({
            type: "column" as const,
            name: c.name,
            displayName: c.name,
            table: selectedTable,
          }))
      : [];

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter, mode]);

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selectedElement = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      selectedElement?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
        case "Tab":
          e.preventDefault();
          if (items[selectedIndex]) {
            const item = items[selectedIndex];
            if (item.type === "table") {
              onSelect(`@${item.name}`);
            } else {
              onSelect(`@${item.table}.${item.name}`);
            }
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [items, selectedIndex, onSelect, onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  if (items.length === 0) {
    return null;
  }

  return (
    <div
      ref={listRef}
      className={cn(
        "absolute z-50 min-w-[200px] max-w-[300px] rounded-lg border border-border",
        "bg-popover shadow-lg animate-in fade-in-0 zoom-in-95",
        "bottom-full left-0 mb-2"
      )}
    >
      <div className="px-2 py-1.5 border-b border-border">
        <p className="text-xs text-muted-foreground">
          {mode === "table" ? "Select a table" : `Columns in ${selectedTable}`}
        </p>
      </div>
      <ScrollArea className="max-h-[200px]">
        <div className="p-1">
          {items.map((item, index) => (
            <button
              key={`${item.type}-${item.name}`}
              data-index={index}
              className={cn(
                "flex items-center gap-2 w-full px-2 py-1.5 text-left text-sm rounded-md",
                "hover:bg-accent hover:text-accent-foreground",
                "focus:outline-none transition-colors",
                selectedIndex === index && "bg-accent text-accent-foreground"
              )}
              onClick={() => {
                if (item.type === "table") {
                  onSelect(`@${item.name}`);
                } else {
                  onSelect(`@${item.table}.${item.name}`);
                }
              }}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {item.type === "table" ? (
                <Table className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Columns className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className="flex-1 truncate">{item.displayName}</span>
              {selectedIndex === index && (
                <Check className="h-3.5 w-3.5 text-primary" />
              )}
            </button>
          ))}
        </div>
      </ScrollArea>
      <div className="px-2 py-1.5 border-t border-border">
        <p className="text-[10px] text-muted-foreground">
          <kbd className="px-1 rounded bg-muted">↑↓</kbd> navigate
          <span className="mx-1.5">|</span>
          <kbd className="px-1 rounded bg-muted">Enter</kbd> select
          <span className="mx-1.5">|</span>
          <kbd className="px-1 rounded bg-muted">Esc</kbd> close
        </p>
      </div>
    </div>
  );
}
