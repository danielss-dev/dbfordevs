import { useState, useMemo } from "react";
import { History, Search, X, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui";
import { useQueryStore } from "@/stores";
import { QueryHistoryItem } from "./QueryHistoryItem";

interface QueryHistoryPanelProps {
  connectionId: string;
  onLoadQuery: (sql: string) => void;
}

export function QueryHistoryPanel({ connectionId, onLoadQuery }: QueryHistoryPanelProps) {
  const { queryHistory, addQueryToHistory, clearHistoryForConnection } = useQueryStore();
  const [searchQuery, setSearchQuery] = useState("");

  const connectionHistory = queryHistory[connectionId] || [];

  const filteredHistory = useMemo(() => {
    if (!searchQuery.trim()) return connectionHistory;

    const query = searchQuery.toLowerCase();
    return connectionHistory.filter((entry) =>
      entry.sql.toLowerCase().includes(query) ||
      entry.error?.toLowerCase().includes(query)
    );
  }, [connectionHistory, searchQuery]);

  const handleDelete = (id: string) => {
    const updatedHistory = connectionHistory.filter((entry) => entry.id !== id);

    // Clear current connection history
    clearHistoryForConnection(connectionId);

    // Re-add entries (in reverse order to maintain chronological order)
    updatedHistory.reverse().forEach((entry) => {
      addQueryToHistory(entry);
    });
  };

  const handleClearAll = () => {
    clearHistoryForConnection(connectionId);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4" />
          <h3 className="text-sm font-semibold">Query History</h3>
          <span className="text-xs text-muted-foreground">
            ({filteredHistory.length})
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleClearAll}
              disabled={connectionHistory.length === 0}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Clear all history</TooltipContent>
        </Tooltip>
      </div>

      <div className="p-3 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search queries..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 pr-8 h-8 text-xs"
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-0 top-1/2 transform -translate-y-1/2 h-7 w-7"
              onClick={() => setSearchQuery("")}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-3 space-y-2">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <History className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "No matching queries found" : "No query history yet"}
              </p>
              {!searchQuery && (
                <p className="text-xs text-muted-foreground mt-1">
                  Execute queries to build your history
                </p>
              )}
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <QueryHistoryItem
                key={entry.id}
                entry={entry}
                onLoad={onLoadQuery}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
