import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Sparkles, Search, PlusCircle, RefreshCw, Trash2, GitMerge, Database, Table2, FileCode } from "lucide-react";
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

interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
  icon: React.ElementType;
}

const SLASH_COMMANDS: SlashCommand[] = [
  {
    name: "select",
    description: "Generate a SELECT query",
    prompt: "Generate a SELECT query to ",
    icon: Search,
  },
  {
    name: "insert",
    description: "Generate an INSERT statement",
    prompt: "Generate an INSERT statement to add data to ",
    icon: PlusCircle,
  },
  {
    name: "update",
    description: "Generate an UPDATE statement",
    prompt: "Generate an UPDATE statement to modify ",
    icon: RefreshCw,
  },
  {
    name: "delete",
    description: "Generate a DELETE statement",
    prompt: "Generate a DELETE statement to remove ",
    icon: Trash2,
  },
  {
    name: "join",
    description: "Generate a JOIN query",
    prompt: "Generate a query that joins ",
    icon: GitMerge,
  },
  {
    name: "create",
    description: "Generate a CREATE TABLE statement",
    prompt: "Generate a CREATE TABLE statement for ",
    icon: Table2,
  },
  {
    name: "describe",
    description: "Describe a table structure",
    prompt: "Describe the structure and columns of ",
    icon: Database,
  },
  {
    name: "optimize",
    description: "Optimize the current query",
    prompt: "Optimize this SQL query for better performance: ",
    icon: FileCode,
  },
];

export function AIInput({ onSend, isLoading }: AIInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { context, isConfigured: checkConfigured } = useAIStore();
  const tables = context.tables || [];
  const configured = checkConfigured();

  // Slash command state
  const [slashCommand, setSlashCommand] = useState<{
    show: boolean;
    filter: string;
    selectedIndex: number;
  }>({ show: false, filter: "", selectedIndex: 0 });

  // Filtered slash commands
  const filteredCommands = useMemo(() => {
    if (!slashCommand.filter) return SLASH_COMMANDS;
    const filter = slashCommand.filter.toLowerCase();
    return SLASH_COMMANDS.filter(
      (cmd) =>
        cmd.name.toLowerCase().includes(filter) ||
        cmd.description.toLowerCase().includes(filter)
    );
  }, [slashCommand.filter]);

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

  // Check if a slash command is valid
  const isValidSlashCommand = useCallback((commandName: string): boolean => {
    return SLASH_COMMANDS.some(
      (cmd) => cmd.name.toLowerCase() === commandName.toLowerCase()
    );
  }, []);

  // Render text with @references and /commands highlighted
  const renderHighlightedText = useMemo(() => {
    if (!value) return null;

    // Match @tablename, @tablename.column, or /command patterns
    const parts: Array<{ text: string; type: "text" | "reference" | "command"; isValid: boolean }> = [];
    let lastIndex = 0;
    // Match either @reference or /command at start of string
    const regex = /(@\w+(?:\.\w+)?|^\/\w+)/g;
    let match;

    while ((match = regex.exec(value)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({ text: value.slice(lastIndex, match.index), type: "text", isValid: false });
      }

      const matchText = match[0];
      if (matchText.startsWith("@")) {
        // Table reference
        const isValid = isValidTableReference(matchText.slice(1));
        parts.push({ text: matchText, type: "reference", isValid });
      } else if (matchText.startsWith("/")) {
        // Slash command (only valid at start)
        const isValid = match.index === 0 && isValidSlashCommand(matchText.slice(1));
        parts.push({ text: matchText, type: "command", isValid });
      }
      lastIndex = regex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < value.length) {
      parts.push({ text: value.slice(lastIndex), type: "text", isValid: false });
    }

    return parts.map((part, i) => {
      if (part.type === "reference") {
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
      if (part.type === "command") {
        return (
          <span
            key={i}
            className={cn(
              "rounded px-0.5 -mx-0.5 font-medium",
              part.isValid
                ? "text-emerald-500 bg-emerald-500/10"
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
  }, [value, isValidTableReference, isValidSlashCommand]);

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

  // Check for / slash command pattern
  useEffect(() => {
    // Only show slash commands at the start of input
    const slashMatch = value.match(/^\/(\w*)$/);
    if (slashMatch) {
      setSlashCommand({
        show: true,
        filter: slashMatch[1],
        selectedIndex: 0,
      });
    } else if (slashCommand.show) {
      setSlashCommand((prev) => ({ ...prev, show: false }));
    }
  }, [value, slashCommand.show]);

  // Handle slash command selection - keep the command visible
  const handleSlashCommandSelect = (command: SlashCommand) => {
    const newValue = `/${command.name} `;
    setValue(newValue);
    setSlashCommand({ show: false, filter: "", selectedIndex: 0 });

    // Focus textarea and move cursor to end
    setTimeout(() => {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(newValue.length, newValue.length);
      }
    }, 0);
  };

  // Expand slash command to full prompt when sending
  const expandSlashCommand = (text: string): string => {
    const match = text.match(/^\/(\w+)\s*(.*)/);
    if (match) {
      const [, commandName, rest] = match;
      const command = SLASH_COMMANDS.find(
        (cmd) => cmd.name.toLowerCase() === commandName.toLowerCase()
      );
      if (command) {
        return command.prompt + rest;
      }
    }
    return text;
  };

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
    // Expand slash command to full prompt before sending
    const messageToSend = expandSlashCommand(value.trim());
    onSend(messageToSend);
    setValue("");
    setDropdown((prev) => ({ ...prev, show: false }));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Handle slash command navigation
    if (slashCommand.show && filteredCommands.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashCommand((prev) => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, filteredCommands.length - 1),
        }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashCommand((prev) => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSlashCommandSelect(filteredCommands[slashCommand.selectedIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSlashCommand({ show: false, filter: "", selectedIndex: 0 });
        return;
      }
    }

    // Don't handle enter/arrows if table dropdown is open (dropdown handles them)
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

        {/* / Slash Command Dropdown */}
        {slashCommand.show && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-72 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">SQL Commands</span>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filteredCommands.map((cmd, index) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.name}
                    type="button"
                    className={cn(
                      "flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
                      index === slashCommand.selectedIndex
                        ? "bg-violet-500/10 text-violet-500"
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => handleSlashCommandSelect(cmd)}
                    onMouseEnter={() =>
                      setSlashCommand((prev) => ({ ...prev, selectedIndex: index }))
                    }
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-60" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">/{cmd.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {cmd.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="px-3 py-1.5 border-t border-border bg-muted/30">
              <span className="text-[10px] text-muted-foreground">
                ↑↓ to navigate · Enter to select · Esc to close
              </span>
            </div>
          </div>
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
            placeholder={configured ? "Ask a question... Type / for commands, @ for tables" : "Please configure API key to chat"}
            disabled={isLoading || !configured}
            rows={1}
            className={cn(
              "relative w-full resize-none bg-transparent px-2 py-2 text-sm",
              "placeholder:text-muted-foreground focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              // Make text transparent when there's content (highlight shows through)
              value ? "text-transparent" : ""
            )}
            style={{ caretColor: "hsl(var(--foreground))" }}
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
        Press Enter to send, Shift+Enter for new line, / for commands, @ for tables
      </p>
    </div>
  );
}

