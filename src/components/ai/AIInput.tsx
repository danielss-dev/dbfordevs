import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Send, Sparkles, Search, PlusCircle, RefreshCw, Trash2, GitMerge, Database, Table2, FileCode, Leaf, Layers, Key, HardDrive } from "lucide-react";
import { Button } from "@/components/ui";
import { useAIStore } from "@/lib/ai/store";
import { useMongoDBStore } from "@/stores/mongodb";
import { useRedisStore } from "@/stores/redis";
import { useConnectionsStore, selectActiveConnection } from "@/stores";
import { cn } from "@/lib/utils";
import { TableReferenceDropdown } from "./TableReferenceDropdown";
import { ProviderModelSwitcher } from "./ProviderModelSwitcher";

interface AIInputProps {
  onSend: (message: string) => void;
  isLoading: boolean;
}

interface DropdownState {
  show: boolean;
  mode: "table" | "column" | "mongo" | "redis";
  filter: string;
  selectedTable?: string;
  atIndex: number;
}

interface SlashCommand {
  name: string;
  description: string;
  prompt: string;
  icon: React.ElementType;
  category: "sql" | "mongodb" | "redis";
}

const SLASH_COMMANDS: SlashCommand[] = [
  // SQL Commands
  {
    name: "select",
    description: "Generate a SELECT query",
    prompt: "Generate a SELECT query to ",
    icon: Search,
    category: "sql",
  },
  {
    name: "insert",
    description: "Generate an INSERT statement",
    prompt: "Generate an INSERT statement to add data to ",
    icon: PlusCircle,
    category: "sql",
  },
  {
    name: "update",
    description: "Generate an UPDATE statement",
    prompt: "Generate an UPDATE statement to modify ",
    icon: RefreshCw,
    category: "sql",
  },
  {
    name: "delete",
    description: "Generate a DELETE statement",
    prompt: "Generate a DELETE statement to remove ",
    icon: Trash2,
    category: "sql",
  },
  {
    name: "join",
    description: "Generate a JOIN query",
    prompt: "Generate a query that joins ",
    icon: GitMerge,
    category: "sql",
  },
  {
    name: "create",
    description: "Generate a CREATE TABLE statement",
    prompt: "Generate a CREATE TABLE statement for ",
    icon: Table2,
    category: "sql",
  },
  {
    name: "describe",
    description: "Describe a table structure",
    prompt: "Describe the structure and columns of ",
    icon: Database,
    category: "sql",
  },
  {
    name: "optimize",
    description: "Optimize the current query",
    prompt: "Optimize this SQL query for better performance: ",
    icon: FileCode,
    category: "sql",
  },
  // MongoDB Commands
  {
    name: "mongo-find",
    description: "Generate a MongoDB find query",
    prompt: "[MongoDB] Generate a find query filter to ",
    icon: Leaf,
    category: "mongodb",
  },
  {
    name: "mongo-aggregate",
    description: "Generate a MongoDB aggregation pipeline",
    prompt: "[MongoDB] Generate an aggregation pipeline to ",
    icon: Layers,
    category: "mongodb",
  },
  {
    name: "mongo-insert",
    description: "Generate a MongoDB insert document",
    prompt: "[MongoDB] Generate a document to insert that ",
    icon: PlusCircle,
    category: "mongodb",
  },
  {
    name: "mongo-update",
    description: "Generate a MongoDB update operation",
    prompt: "[MongoDB] Generate an update operation to ",
    icon: RefreshCw,
    category: "mongodb",
  },
  // Redis Commands
  {
    name: "redis-cmd",
    description: "Generate Redis commands",
    prompt: "[Redis] Generate Redis commands to ",
    icon: Key,
    category: "redis",
  },
  {
    name: "redis-structure",
    description: "Recommend a Redis data structure",
    prompt: "[Redis] Recommend the best Redis data structure for ",
    icon: HardDrive,
    category: "redis",
  },
  {
    name: "redis-cache",
    description: "Design a Redis caching strategy",
    prompt: "[Redis] Design a caching strategy using Redis for ",
    icon: Database,
    category: "redis",
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

  // Get active connection info
  const activeConnection = useConnectionsStore(selectActiveConnection);
  const databaseType = activeConnection?.databaseType?.toLowerCase();
  const isMongoConnection = databaseType === "mongodb";
  const isRedisConnection = databaseType === "redis";

  // Get MongoDB collections
  const { collectionsByDb, databasesByConnection, selectedDatabaseByConnection } = useMongoDBStore();
  const mongoCollections = useMemo(() => {
    if (!isMongoConnection || !activeConnection) return [];
    const selectedDb = selectedDatabaseByConnection[activeConnection.id];
    if (!selectedDb) {
      // Return all collections from all databases
      const allCollections: { db: string; name: string }[] = [];
      const databases = databasesByConnection[activeConnection.id] || [];
      databases.forEach(db => {
        const key = `${activeConnection.id}:${db.name}`;
        const cols = collectionsByDb[key] || [];
        cols.forEach(col => allCollections.push({ db: db.name, name: col.name }));
      });
      return allCollections;
    }
    const key = `${activeConnection.id}:${selectedDb}`;
    return (collectionsByDb[key] || []).map(col => ({ db: selectedDb, name: col.name }));
  }, [isMongoConnection, activeConnection, collectionsByDb, databasesByConnection, selectedDatabaseByConnection]);

  // Get Redis keys
  const { keysByConnection } = useRedisStore();
  const redisKeys = useMemo(() => {
    if (!isRedisConnection || !activeConnection) return [];
    return keysByConnection[activeConnection.id] || [];
  }, [isRedisConnection, activeConnection, keysByConnection]);

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
  // Different databases return table info differently:
  // - PostgreSQL/Oracle: name includes schema (e.g., "public.users")
  // - MySQL/SQLite: name is just table name (e.g., "users"), schema is database name
  // - MSSQL: name is just table name, schema is separate (e.g., "dbo")
  const isValidTableReference = useCallback((reference: string): boolean => {
    const ref = reference.toLowerCase();

    // Check for MongoDB collection reference: @mongo:db.collection or @mongo:collection
    if (ref.startsWith("mongo:")) {
      const mongoRef = ref.slice(6); // Remove "mongo:" prefix
      return mongoCollections.some(col => {
        const fullName = `${col.db}.${col.name}`.toLowerCase();
        return fullName === mongoRef || col.name.toLowerCase() === mongoRef;
      });
    }

    // Check for Redis key reference: @redis:keypattern
    if (ref.startsWith("redis:")) {
      const redisRef = ref.slice(6); // Remove "redis:" prefix
      return redisKeys.some(key => key.key.toLowerCase().includes(redisRef));
    }

    // Standard SQL table reference - table.name is always bare (no schema prefix)
    return tables.some((table) => {
      const tableNameLower = table.name.toLowerCase();
      const schemaName = table.schema?.toLowerCase();

      // If reference doesn't include schema, match against table name
      if (!ref.includes('.')) {
        return tableNameLower === ref;
      }

      // Reference includes schema (e.g., @schema.table)
      const [refSchema, refTable] = ref.split('.');
      return schemaName === refSchema && tableNameLower === refTable;
    });
  }, [tables, mongoCollections, redisKeys]);

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

    // Match @tablename, @tablename.column, @mongo:collection, @redis:key, or /command patterns
    const parts: Array<{ text: string; type: "text" | "reference" | "command"; isValid: boolean }> = [];
    let lastIndex = 0;
    // Match @reference (including @mongo:xxx and @redis:xxx) or /command at start of string
    const regex = /(@(?:mongo|redis):[^\s]+|@\w+(?:\.\w+)?|^\/[\w-]+)/g;
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

    // Check for @mongo: pattern for MongoDB collections
    const mongoMatch = textBeforeCursor.match(/@mongo:([^\s]*)$/);
    if (mongoMatch) {
      const atIndex = cursorPos - mongoMatch[0].length;
      setDropdown({
        show: true,
        mode: "mongo",
        filter: mongoMatch[1],
        atIndex,
      });
      return;
    }

    // Check for @redis: pattern for Redis keys
    const redisMatch = textBeforeCursor.match(/@redis:([^\s]*)$/);
    if (redisMatch) {
      const atIndex = cursorPos - redisMatch[0].length;
      setDropdown({
        show: true,
        mode: "redis",
        filter: redisMatch[1],
        atIndex,
      });
      return;
    }

    // Check for @table.column pattern
    const columnMatch = textBeforeCursor.match(/@(\w+)\.(\w*)$/);
    if (columnMatch) {
      const tableName = columnMatch[1].toLowerCase();
      const columnFilter = columnMatch[2];
      // Find table by bare name (all drivers now return bare names)
      const table = tables.find((t) => t.name.toLowerCase() === tableName);

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

  // Check for @ pattern on value change (debounced to avoid lag on fast typing)
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForAtPattern();
    }, 120);
    return () => clearTimeout(timer);
  }, [value, checkForAtPattern]);

  // Check for / slash command pattern
  useEffect(() => {
    // Only show slash commands at the start of input (allowing dashes for mongo-find, redis-cmd, etc.)
    const slashMatch = value.match(/^\/([a-z-]*)$/i);
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
        {/* @ Table/Collection/Key Reference Dropdown */}
        {dropdown.show && (
          (dropdown.mode === "mongo" && mongoCollections.length > 0) ||
          (dropdown.mode === "redis" && redisKeys.length > 0) ||
          ((dropdown.mode === "table" || dropdown.mode === "column") && tables.length > 0)
        ) && (
          <TableReferenceDropdown
            filter={dropdown.filter}
            tables={tables}
            onSelect={handleSelect}
            onClose={handleCloseDropdown}
            mode={dropdown.mode}
            selectedTable={dropdown.selectedTable}
            mongoCollections={mongoCollections}
            redisKeys={redisKeys}
          />
        )}

        {/* / Slash Command Dropdown */}
        {slashCommand.show && filteredCommands.length > 0 && (
          <div className="absolute bottom-full left-0 mb-2 w-80 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-border bg-muted/30">
              <span className="text-xs font-medium text-muted-foreground">Commands</span>
            </div>
            <div className="max-h-72 overflow-y-auto py-1">
              {(() => {
                let lastCategory: string | null = null;
                let globalIndex = 0;
                return filteredCommands.map((cmd) => {
                  const Icon = cmd.icon;
                  const currentIndex = globalIndex++;
                  const showCategoryHeader = cmd.category !== lastCategory;
                  lastCategory = cmd.category;

                  const categoryLabels: Record<string, string> = {
                    sql: "SQL",
                    mongodb: "MongoDB",
                    redis: "Redis",
                  };
                  const categoryColors: Record<string, string> = {
                    sql: "text-blue-500",
                    mongodb: "text-green-500",
                    redis: "text-red-500",
                  };

                  return (
                    <div key={cmd.name}>
                      {showCategoryHeader && (
                        <div className={cn(
                          "px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider",
                          categoryColors[cmd.category]
                        )}>
                          {categoryLabels[cmd.category]}
                        </div>
                      )}
                      <button
                        type="button"
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-2 text-left transition-colors",
                          currentIndex === slashCommand.selectedIndex
                            ? "bg-violet-500/10 text-violet-500"
                            : "hover:bg-muted/50"
                        )}
                        onClick={() => handleSlashCommandSelect(cmd)}
                        onMouseEnter={() =>
                          setSlashCommand((prev) => ({ ...prev, selectedIndex: currentIndex }))
                        }
                      >
                        <Icon className={cn(
                          "h-4 w-4 shrink-0",
                          categoryColors[cmd.category]
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">/{cmd.name}</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">
                            {cmd.description}
                          </p>
                        </div>
                      </button>
                    </div>
                  );
                });
              })()}
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
            placeholder={configured ? "Ask a question... / for commands, @ for tables, @mongo: @redis:" : "Please configure API key to chat"}
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
        Enter to send, Shift+Enter new line, / commands, @ tables, @mongo: collections, @redis: keys
      </p>
    </div>
  );
}

