/**
 * QueryHistoryPanel
 *
 * Panel showing recent AI-generated queries with favorites functionality.
 */

import { useState } from "react";
import { X, Star, Copy, Play, Trash2, Search } from "lucide-react";
import {
  Button,
  Input,
  ScrollArea,
} from "@/components/ui";
import { useAIStore } from "@/extensions/ai/store";
import { PROVIDER_INFO, type AIQueryHistoryItem } from "@/extensions/ai/types";
import { cn } from "@/lib/utils";

interface QueryHistoryPanelProps {
  onClose: () => void;
  onSelectQuery: (prompt: string) => void;
}

export function QueryHistoryPanel({ onClose, onSelectQuery }: QueryHistoryPanelProps) {
  const { queryHistory, toggleFavorite, clearHistory } = useAIStore();
  const [filter, setFilter] = useState("");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredHistory = queryHistory.filter((item) => {
    if (showFavoritesOnly && !item.isFavorite) return false;
    if (filter) {
      const searchLower = filter.toLowerCase();
      return (
        item.prompt.toLowerCase().includes(searchLower) ||
        item.generatedSQL?.toLowerCase().includes(searchLower)
      );
    }
    return true;
  });

  const handleCopy = async (item: AIQueryHistoryItem) => {
    if (item.generatedSQL) {
      await navigator.clipboard.writeText(item.generatedSQL);
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleRerun = (item: AIQueryHistoryItem) => {
    onSelectQuery(item.prompt);
    onClose();
  };

  const formatTimestamp = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div
      className={cn(
        "fixed right-[420px] top-0 bottom-0 z-40 flex flex-col",
        "w-[360px] border-l border-border bg-background shadow-xl",
        "animate-in slide-in-from-right duration-200"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-semibold text-sm">Query History</h3>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", showFavoritesOnly && "text-yellow-500")}
            onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
            title={showFavoritesOnly ? "Show all" : "Show favorites only"}
          >
            <Star className={cn("h-4 w-4", showFavoritesOnly && "fill-current")} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearHistory}
            disabled={queryHistory.length === 0}
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-4 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search queries..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* History List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-sm text-muted-foreground">
                {queryHistory.length === 0
                  ? "No queries yet"
                  : showFavoritesOnly
                  ? "No favorites"
                  : "No matching queries"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((item) => (
                <div
                  key={item.id}
                  className="group rounded-lg border border-border p-3 hover:bg-muted/50 transition-colors"
                >
                  {/* Prompt */}
                  <p className="text-sm line-clamp-2 mb-2">{item.prompt}</p>

                  {/* SQL Preview */}
                  {item.generatedSQL && (
                    <pre className="text-xs font-mono text-muted-foreground bg-muted/50 rounded p-2 mb-2 line-clamp-2 overflow-hidden">
                      {item.generatedSQL}
                    </pre>
                  )}

                  {/* Meta and actions */}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>{formatTimestamp(item.timestamp)}</span>
                      <span className="opacity-50">|</span>
                      <span>{PROVIDER_INFO[item.provider]?.displayName}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => toggleFavorite(item.id)}
                        title={item.isFavorite ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star
                          className={cn(
                            "h-3.5 w-3.5",
                            item.isFavorite && "fill-yellow-500 text-yellow-500"
                          )}
                        />
                      </Button>
                      {item.generatedSQL && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => handleCopy(item)}
                          title="Copy SQL"
                        >
                          <Copy className={cn("h-3.5 w-3.5", copiedId === item.id && "text-green-500")} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => handleRerun(item)}
                        title="Run again"
                      >
                        <Play className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
