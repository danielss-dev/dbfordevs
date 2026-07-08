import { useState, useEffect, useMemo, useRef } from "react";
import { Undo2, Loader2, Copy, Check, Code, FileText, WrapText, ChevronRight, ChevronDown } from "lucide-react";
import { Button, Textarea, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import { useRedisChangesStore } from "@/stores/redis-changes";
import { copyToClipboard, cn } from "@/lib/utils";

interface RedisStringEditorProps {
  connectionId: string;
  keyName: string;
}

type ViewMode = "raw" | "formatted";

// JSON syntax highlighting colors
const JSON_COLORS = {
  key: "text-purple-500 dark:text-purple-400",
  string: "text-green-600 dark:text-green-400",
  number: "text-blue-500 dark:text-blue-400",
  boolean: "text-orange-500 dark:text-orange-400",
  null: "text-muted-foreground",
  bracket: "text-foreground",
  punctuation: "text-muted-foreground",
};

interface JsonNodeProps {
  data: unknown;
  level?: number;
  isLast?: boolean;
  keyName?: string;
}

function JsonNode({ data, level = 0, isLast = true, keyName }: JsonNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const indent = level * 16;

  if (data === null) {
    return (
      <span>
        {keyName !== undefined && (
          <>
            <span className={JSON_COLORS.key}>"{keyName}"</span>
            <span className={JSON_COLORS.punctuation}>: </span>
          </>
        )}
        <span className={JSON_COLORS.null}>null</span>
        {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
      </span>
    );
  }

  if (typeof data === "boolean") {
    return (
      <span>
        {keyName !== undefined && (
          <>
            <span className={JSON_COLORS.key}>"{keyName}"</span>
            <span className={JSON_COLORS.punctuation}>: </span>
          </>
        )}
        <span className={JSON_COLORS.boolean}>{data.toString()}</span>
        {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
      </span>
    );
  }

  if (typeof data === "number") {
    return (
      <span>
        {keyName !== undefined && (
          <>
            <span className={JSON_COLORS.key}>"{keyName}"</span>
            <span className={JSON_COLORS.punctuation}>: </span>
          </>
        )}
        <span className={JSON_COLORS.number}>{data}</span>
        {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
      </span>
    );
  }

  if (typeof data === "string") {
    // Truncate long strings in the view
    const displayValue = data.length > 500 ? data.substring(0, 500) + "..." : data;
    return (
      <span>
        {keyName !== undefined && (
          <>
            <span className={JSON_COLORS.key}>"{keyName}"</span>
            <span className={JSON_COLORS.punctuation}>: </span>
          </>
        )}
        <span className={JSON_COLORS.string}>"{displayValue}"</span>
        {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
      </span>
    );
  }

  if (Array.isArray(data)) {
    const isEmpty = data.length === 0;

    if (isEmpty) {
      return (
        <span>
          {keyName !== undefined && (
            <>
              <span className={JSON_COLORS.key}>"{keyName}"</span>
              <span className={JSON_COLORS.punctuation}>: </span>
            </>
          )}
          <span className={JSON_COLORS.bracket}>[]</span>
          {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
        </span>
      );
    }

    return (
      <div>
        <span
          className="inline-flex items-center cursor-pointer hover:bg-muted/50 rounded px-0.5 -ml-0.5"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          {keyName !== undefined && (
            <>
              <span className={JSON_COLORS.key}>"{keyName}"</span>
              <span className={JSON_COLORS.punctuation}>: </span>
            </>
          )}
          <span className={JSON_COLORS.bracket}>[</span>
          {!isExpanded && (
            <span className="text-muted-foreground text-xs ml-1">
              {data.length} items
            </span>
          )}
        </span>
        {isExpanded && (
          <div style={{ marginLeft: indent + 16 }}>
            {data.map((item, index) => (
              <div key={index}>
                <JsonNode
                  data={item}
                  level={level + 1}
                  isLast={index === data.length - 1}
                />
              </div>
            ))}
          </div>
        )}
        <span style={{ marginLeft: isExpanded ? indent : 0 }}>
          <span className={JSON_COLORS.bracket}>]</span>
          {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
        </span>
      </div>
    );
  }

  if (typeof data === "object") {
    const entries = Object.entries(data as Record<string, unknown>);
    const isEmpty = entries.length === 0;

    if (isEmpty) {
      return (
        <span>
          {keyName !== undefined && (
            <>
              <span className={JSON_COLORS.key}>"{keyName}"</span>
              <span className={JSON_COLORS.punctuation}>: </span>
            </>
          )}
          <span className={JSON_COLORS.bracket}>{"{}"}</span>
          {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
        </span>
      );
    }

    return (
      <div>
        <span
          className="inline-flex items-center cursor-pointer hover:bg-muted/50 rounded px-0.5 -ml-0.5"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-3 w-3 text-muted-foreground" />
          )}
          {keyName !== undefined && (
            <>
              <span className={JSON_COLORS.key}>"{keyName}"</span>
              <span className={JSON_COLORS.punctuation}>: </span>
            </>
          )}
          <span className={JSON_COLORS.bracket}>{"{"}</span>
          {!isExpanded && (
            <span className="text-muted-foreground text-xs ml-1">
              {entries.length} {entries.length === 1 ? "field" : "fields"}
            </span>
          )}
        </span>
        {isExpanded && (
          <div style={{ marginLeft: indent + 16 }}>
            {entries.map(([key, val], index) => (
              <div key={key}>
                <JsonNode
                  data={val}
                  keyName={key}
                  level={level + 1}
                  isLast={index === entries.length - 1}
                />
              </div>
            ))}
          </div>
        )}
        <span style={{ marginLeft: isExpanded ? indent : 0 }}>
          <span className={JSON_COLORS.bracket}>{"}"}</span>
          {!isLast && <span className={JSON_COLORS.punctuation}>,</span>}
        </span>
      </div>
    );
  }

  return <span className="text-muted-foreground">{String(data)}</span>;
}

function JsonViewer({ value }: { value: string }) {
  const parsed = useMemo(() => {
    try {
      return { data: JSON.parse(value), error: null };
    } catch (e) {
      return { data: null, error: e instanceof Error ? e.message : "Invalid JSON" };
    }
  }, [value]);

  if (parsed.error) {
    return (
      <div className="p-4 text-sm text-destructive">
        Invalid JSON: {parsed.error}
      </div>
    );
  }

  return (
    <div className="p-4 font-mono text-sm overflow-auto">
      <JsonNode data={parsed.data} />
    </div>
  );
}

export function RedisStringEditor({ connectionId, keyName }: RedisStringEditorProps) {
  const { getString } = useRedis();
  const { toast } = useToast();
  const { addChange, updateChange, removeChange, clearChangesForKey } = useRedisChangesStore();
  const [value, setValue] = useState("");
  const [originalValue, setOriginalValue] = useState("");
  const [encoding, setEncoding] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("formatted");
  const [wordWrap, setWordWrap] = useState(true);
  const pendingChangeIdRef = useRef<string | null>(null);

  // Subscribe reactively to pending changes, derive filtered list with useMemo
  // (selector must return stable reference to avoid infinite re-render loop)
  const allPendingChanges = useRedisChangesStore((state) => state.pendingChanges);
  const pendingChanges = useMemo(
    () => allPendingChanges.filter((c) => c.connectionId === connectionId && c.key === keyName),
    [allPendingChanges, connectionId, keyName]
  );
  const pendingSetChange = useMemo(
    () => pendingChanges.find((c) => c.operation.op === "SET"),
    [pendingChanges]
  );

  // Detect when changes are committed/cleared externally (e.g. from Changes panel)
  useEffect(() => {
    if (isLoading) return;

    // If we had a tracked pending change but it no longer exists in the store,
    // it was committed or cleared - update originalValue to current value
    if (pendingChangeIdRef.current && !pendingSetChange) {
      setOriginalValue(value);
      pendingChangeIdRef.current = null;
    }
  }, [pendingSetChange, isLoading]);

  // Detect if value is JSON
  const isJson = useMemo(() => {
    if (!value) return false;
    const trimmed = value.trim();
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return false;
    try {
      JSON.parse(value);
      return true;
    } catch {
      return false;
    }
  }, [value]);

  const loadValue = async () => {
    setIsLoading(true);
    try {
      const result = await getString(connectionId, keyName);
      if (result) {
        // Check if there's an existing pending SET change for this key
        const storeChanges = useRedisChangesStore.getState().getChangesForKey(connectionId, keyName);
        const existingSet = storeChanges.find((c) => c.operation.op === "SET");
        if (existingSet && existingSet.operation.op === "SET") {
          setValue(existingSet.operation.value);
          pendingChangeIdRef.current = existingSet.id;
        } else {
          setValue(result.value);
        }
        setOriginalValue(result.value);
        setEncoding(result.encoding);
      }
    } catch (error) {
      toast({
        title: "Error loading value",
        description: error instanceof Error ? error.message : "Failed to load string value",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadValue();
  }, [connectionId, keyName]);

  // Stage changes automatically when value changes
  useEffect(() => {
    if (isLoading) return;

    if (value !== originalValue) {
      const operation = { op: "SET" as const, value, originalValue };

      // Check if our tracked ref still exists in the store
      const refStillExists = pendingChangeIdRef.current && pendingSetChange?.id === pendingChangeIdRef.current;

      if (refStillExists) {
        updateChange(pendingChangeIdRef.current!, operation);
      } else {
        // If there's an existing SET change we don't know about, update it
        if (pendingSetChange) {
          pendingChangeIdRef.current = pendingSetChange.id;
          updateChange(pendingSetChange.id, operation);
        } else {
          // Create a new change
          addChange({
            connectionId,
            key: keyName,
            keyType: "string",
            operation,
          });
          // Find the newly added change to track its ID
          const newChanges = useRedisChangesStore.getState().getChangesForKey(connectionId, keyName);
          const newSet = newChanges.find((c) => c.operation.op === "SET");
          if (newSet) {
            pendingChangeIdRef.current = newSet.id;
          }
        }
      }
    } else {
      // Value reverted to original - remove any pending SET change
      if (pendingChangeIdRef.current) {
        removeChange(pendingChangeIdRef.current);
        pendingChangeIdRef.current = null;
      }
    }
  }, [value, originalValue, isLoading]);

  const handleDiscard = () => {
    setValue(originalValue);
    clearChangesForKey(connectionId, keyName);
    pendingChangeIdRef.current = null;
  };

  const handleCopy = async () => {
    const success = await copyToClipboard(value);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleFormat = () => {
    if (isJson) {
      try {
        const parsed = JSON.parse(value);
        setValue(JSON.stringify(parsed, null, 2));
      } catch {
        // Ignore format errors
      }
    }
  };

  const handleMinify = () => {
    if (isJson) {
      try {
        const parsed = JSON.parse(value);
        setValue(JSON.stringify(parsed));
      } catch {
        // Ignore format errors
      }
    }
  };

  const hasChanges = value !== originalValue;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* View mode toggle - only show for JSON */}
          {isJson && (
            <div className="flex items-center border rounded-md overflow-hidden">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "rounded-none h-7 px-2",
                      viewMode === "formatted" && "bg-muted"
                    )}
                    onClick={() => setViewMode("formatted")}
                  >
                    <Code className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Formatted View</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "rounded-none h-7 px-2",
                      viewMode === "raw" && "bg-muted"
                    )}
                    onClick={() => setViewMode("raw")}
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Raw Editor</TooltipContent>
              </Tooltip>
            </div>
          )}

          <div className="text-xs text-muted-foreground">
            {encoding && <span className="mr-3">Encoding: {encoding}</span>}
            <span>{value.length} chars</span>
            {isJson && (
              <span className="ml-2 px-1.5 py-0.5 rounded bg-info/10 text-info">
                JSON
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* JSON formatting buttons */}
          {isJson && viewMode === "raw" && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7" onClick={handleFormat}>
                    Format
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Pretty print JSON</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-7" onClick={handleMinify}>
                    Minify
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Minify JSON</TooltipContent>
              </Tooltip>
            </>
          )}

          {viewMode === "raw" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-2", wordWrap && "bg-muted")}
                  onClick={() => setWordWrap(!wordWrap)}
                >
                  <WrapText className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Word Wrap</TooltipContent>
            </Tooltip>
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>Copy to clipboard</TooltipContent>
          </Tooltip>

          {hasChanges && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  onClick={handleDiscard}
                >
                  <Undo2 className="h-3.5 w-3.5 mr-1" />
                  Discard
                </Button>
              </TooltipTrigger>
              <TooltipContent>Revert to original value</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Content */}
      <div className={cn(
        "flex-1 border rounded-md overflow-hidden bg-muted/30",
        hasChanges && "border-warning/50"
      )}>
        {isJson && viewMode === "formatted" ? (
          <div className="h-full overflow-auto">
            <JsonViewer value={value} />
          </div>
        ) : (
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className={cn(
              "h-full font-mono text-sm resize-none border-0 rounded-none bg-transparent",
              !wordWrap && "whitespace-pre overflow-x-auto"
            )}
            style={!wordWrap ? { overflowWrap: "normal" } : undefined}
            placeholder="Enter string value..."
          />
        )}
      </div>

      {hasChanges && (
        <div className="mt-2 text-xs text-warning">
          Staged change (commit from Changes panel)
        </div>
      )}
    </div>
  );
}
