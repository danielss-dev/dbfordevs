import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui";
import { useAIStore } from "@/extensions/ai/store";
import { cn } from "@/lib/utils";
import { TableReferenceDropdown } from "./TableReferenceDropdown";
import { ProviderModelSwitcher } from "./ProviderModelSwitcher";

interface AIInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

interface DropdownState {
  show: boolean;
  mode: "table" | "column";
  filter: string;
  selectedTable?: string;
  atIndex: number;
}

export function AIInput({ onSend, isLoading }: AIInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { context, isConfigured: checkConfigured } = useAIStore();
  const tables = context.tables || [];
  const configured = checkConfigured();

  // Check if a reference matches any table (handles both "table" and "schema.table" formats)
  const isValidTableReference = useCallback((reference: string): boolean => {
    const ref = reference.toLowerCase();
    return tables.some((table) => {
      const tableName = table.name.toLowerCase();
      const schemaName = table.schema?.toLowerCase();

      // Check just table name: @accounts
      if (tableName === ref) return true;

      // Check full qualified name: @public.accounts
      if (schemaName && ref === `${schemaName}.${tableName}`) return true;

      // Check if ref is schema.table format
      if (ref.includes(".")) {
        const [refSchema, refTable] = ref.split(".");
        if (schemaName === refSchema && tableName === refTable) return true;
      }

      return false;
    });
  }, [tables]);

  const [dropdown, setDropdown] = useState<DropdownState>({
    show: false,
    mode: "table",
    filter: "",
    atIndex: -1,
  });

  // Auto-resize textarea and sync highlight scroll
  useEffect(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
      if (highlight) {
        highlight.style.height = textarea.style.height;
      }
    }
  }, [value]);

  // Sync scroll between textarea and highlight overlay
  const handleScroll = useCallback(() => {
    const textarea = textareaRef.current;
    const highlight = highlightRef.current;
    if (textarea && highlight) {
      highlight.scrollTop = textarea.scrollTop;
      highlight.scrollLeft = textarea.scrollLeft;
    }
  }, []);

  // Render text with @references highlighted
  const renderHighlightedText = useMemo(() => {
    if (!value) return null;

    // Match @tablename or @tablename.column patterns
    const parts: Array<{ text: string; isReference: boolean; isValid: boolean }> = [];
    let lastIndex = 0;
    const regex = /@(\w+(?:\.\w+)?)/g;
    let match;

    while ((match = regex.exec(value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({ text: value.slice(lastIndex, match.index), isReference: false, isValid: false });
      }

      // Check if it's a valid table reference (handles both @table and @schema.table)
      const isValid = isValidTableReference(match[1]);

      parts.push({ text: match[0], isReference: true, isValid });
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({ text: value.slice(lastIndex), isReference: false, isValid: false });
    }

    return parts.map((part, i) => {
      if (part.isReference) {
        return (
          <span
            key={i}
            className={cn(
              "rounded px-0.5 -mx-0.5",
              part.isValid
                ? "text-violet-500 bg-violet-500/10 font-medium"
                : "text-orange-500 bg-orange-500/10"
            )}
          >
            {part.text}
          </span>
        );
      }
      // Preserve whitespace and newlines
      return <span key={i}>{part.text}</span>;
    });
  }, [value, isValidTableReference]);

  // Check for @ pattern and show dropdown
  const checkForAtPattern = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const cursorPos = textarea.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);

    // Check for @table.column pattern
    const columnMatch = textBeforeCursor.match(/@(\w+)\.(\w*)$/);
    if (columnMatch) {
      const tableName = columnMatch[1];
      const columnFilter = columnMatch[2];
      const table = tables.find((t) => t.name.toLowerCase() === tableName.toLowerCase());

      if (table) {
        const atIndex = cursorPos - columnMatch[0].length;
        setDropdown({
          show: true,
          mode: "column",
          filter: columnFilter,
          selectedTable: table.name,
          atIndex,
        });
        return;
      }
    }

    // Check for @table pattern
    const tableMatch = textBeforeCursor.match(/@(\w*)$/);
    if (tableMatch) {
      const atIndex = cursorPos - tableMatch[0].length;
      setDropdown({
        show: true,
        mode: "table",
        filter: tableMatch[1],
        atIndex,
      });
      return;
    }

    // No match, close dropdown
    if (dropdown.show) {
      setDropdown((prev) => ({ ...prev, show: false }));
    }
  }, [value, tables, dropdown.show]);

  // Check for @ pattern on value change
  useEffect(() => {
    checkForAtPattern();
  }, [value, checkForAtPattern]);

  const handleSelect = (reference: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Replace from @ to cursor with the selected reference
    const before = value.substring(0, dropdown.atIndex);
    const after = value.substring(textarea.selectionStart);
    const newValue = `${before}${reference} ${after}`;

    setValue(newValue);
    setDropdown((prev) => ({ ...prev, show: false }));

    // Focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = dropdown.atIndex + reference.length + 1;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleCloseDropdown = () => {
    setDropdown((prev) => ({ ...prev, show: false }));
  };

  const handleSubmit = () => {
    if (!value.trim() || isLoading || !configured) return;
    onSend(value.trim());
    setValue("");
    setDropdown((prev) => ({ ...prev, show: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Don't handle enter/arrows if dropdown is open (dropdown handles them)
    if (dropdown.show && ["Enter", "ArrowUp", "ArrowDown", "Tab", "Escape"].includes(e.key)) {
      return;
    }

    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="border-t border-border bg-muted/30 p-4">
      <div className="flex items-center justify-between mb-2">
        <ProviderModelSwitcher />
      </div>
      <div
        ref={containerRef}
        className={cn(
          "relative flex items-end gap-2 rounded-xl border border-border bg-background p-2",
          "focus-within:ring-2 focus-within:ring-violet-500/20 focus-within:border-violet-500/50",
          "transition-all duration-200"
        )}
      >
        {/* @ Table Reference Dropdown */}
        {dropdown.show && tables.length > 0 && (
          <TableReferenceDropdown
            filter={dropdown.filter}
            tables={tables}
            onSelect={handleSelect}
            onClose={handleCloseDropdown}
            mode={dropdown.mode}
            selectedTable={dropdown.selectedTable}
          />
        )}

        <div className="flex-1 min-h-[40px] relative">
          {/* Highlight overlay - renders behind textarea */}
          <div
            ref={highlightRef}
            aria-hidden="true"
            className={cn(
              "absolute inset-0 px-2 py-2 text-sm whitespace-pre-wrap break-words",
              "pointer-events-none overflow-hidden"
            )}
          >
            {renderHighlightedText}
          </div>
          {/* Actual textarea - transparent text, visible caret */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            placeholder={configured ? "Ask a question... Use @ to reference tables" : "Please configure API key to chat"}
            disabled={isLoading || !configured}
            rows={1}
            className={cn(
              "relative w-full resize-none bg-transparent px-2 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Make text transparent when there's content (highlight shows through)
              value ? "text-transparent caret-foreground" : ""
            )}
            style={{ caretColor: "currentColor" }}
          />
        </div>
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading || !configured}
          className={cn(
            "h-9 w-9 shrink-0 rounded-lg",
            "bg-gradient-to-r from-violet-500 to-purple-600",
            "hover:from-violet-600 hover:to-purple-700",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "transition-all duration-200"
          )}
        >
          {isLoading ? (
            <Sparkles className="h-4 w-4 animate-pulse" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground text-center">
        Press Enter to send, Shift+Enter for new line, @ to reference tables
      </p>
    </div>
  );
}

