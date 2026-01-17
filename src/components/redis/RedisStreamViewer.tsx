import { useState, useEffect } from "react";
import { Plus, Trash2, Loader2, RefreshCw, ChevronDown, ChevronRight } from "lucide-react";
import { Button, Input, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useRedis, useToast } from "@/hooks";
import type { RedisStreamEntry } from "@/types";
import { cn } from "@/lib/utils";

interface RedisStreamViewerProps {
  connectionId: string;
  keyName: string;
}

export function RedisStreamViewer({ connectionId, keyName }: RedisStreamViewerProps) {
  const { getStream, streamAdd, streamDelete } = useRedis();
  const { toast } = useToast();
  const [entries, setEntries] = useState<RedisStreamEntry[]>([]);
  const [length, setLength] = useState(0);
  const [firstEntryId, setFirstEntryId] = useState<string | undefined>();
  const [lastEntryId, setLastEntryId] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(true);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const [newField, setNewField] = useState("");
  const [newValue, setNewValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const loadStream = async () => {
    setIsLoading(true);
    try {
      const result = await getStream(connectionId, keyName, "-", "+", 50);
      if (result) {
        setEntries(result.entries);
        setLength(result.length);
        setFirstEntryId(result.firstEntryId);
        setLastEntryId(result.lastEntryId);
        // Expand first entry by default
        if (result.entries.length > 0) {
          setExpandedEntries(new Set([result.entries[0].id]));
        }
      }
    } catch (error) {
      toast({
        title: "Error loading stream",
        description: error instanceof Error ? error.message : "Failed to load stream",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStream();
  }, [connectionId, keyName]);

  const handleAdd = async () => {
    if (!newField.trim() || !newValue.trim()) return;

    setIsSaving(true);
    try {
      const entryId = await streamAdd(connectionId, keyName, { [newField]: newValue });
      if (entryId) {
        setNewField("");
        setNewValue("");
        await loadStream();
        toast({
          title: "Entry added",
          description: `Entry ${entryId} added to stream.`,
        });
      }
    } catch (error) {
      toast({
        title: "Error adding entry",
        description: error instanceof Error ? error.message : "Failed to add entry",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSaving(true);
    try {
      await streamDelete(connectionId, keyName, [id]);
      await loadStream();
      toast({
        title: "Entry deleted",
        description: `Entry ${id} deleted from stream.`,
      });
    } catch (error) {
      toast({
        title: "Error deleting entry",
        description: error instanceof Error ? error.message : "Failed to delete entry",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEntry = (id: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedEntries(newExpanded);
  };

  const formatTimestamp = (id: string) => {
    // Stream ID format: timestamp-sequence
    const timestamp = parseInt(id.split("-")[0], 10);
    if (isNaN(timestamp)) return id;
    return new Date(timestamp).toLocaleString();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Add new entry */}
      <div className="flex items-center gap-2 p-3 border-b">
        <Input
          placeholder="Field name..."
          value={newField}
          onChange={(e) => setNewField(e.target.value)}
          className="w-1/3"
        />
        <Input
          placeholder="Field value..."
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === "Enter") handleAdd();
          }}
        />
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!newField.trim() || !newValue.trim() || isSaving}
        >
          <Plus className="h-4 w-4 mr-1" />
          XADD
        </Button>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              onClick={loadStream}
              disabled={isLoading}
            >
              <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Refresh</TooltipContent>
        </Tooltip>
      </div>

      {/* Stream info */}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-muted-foreground border-b">
        <span>{length} entries</span>
        <span>
          {firstEntryId && lastEntryId && (
            <>
              Range: {firstEntryId} - {lastEntryId}
            </>
          )}
        </span>
      </div>

      {/* Stream entries */}
      <div className="flex-1 overflow-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="border-b last:border-b-0">
            <div
              className="group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/30"
              onClick={() => toggleEntry(entry.id)}
            >
              {expandedEntries.has(entry.id) ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
              <span className="font-mono text-sm text-primary">{entry.id}</span>
              <span className="text-xs text-muted-foreground">
                {formatTimestamp(entry.id)}
              </span>
              <span className="flex-1" />
              <span className="text-xs text-muted-foreground">
                {Object.keys(entry.fields).length} fields
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(entry.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {expandedEntries.has(entry.id) && (
              <div className="pl-9 pr-3 pb-2">
                {Object.entries(entry.fields).map(([field, value]) => (
                  <div
                    key={field}
                    className="flex items-center gap-2 py-1 text-sm"
                  >
                    <span className="font-mono text-muted-foreground w-1/4 truncate">
                      {field}
                    </span>
                    <span className="font-mono truncate">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}

        {entries.length === 0 && (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <p className="text-sm">Stream is empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
