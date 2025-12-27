import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TableSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  matchCount?: number;
}

export function TableSearch({ value, onChange, onClear, matchCount }: TableSearchProps) {
  const [localValue, setLocalValue] = useState(value);

  // Sync local value with prop value
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Debounce the onChange callback
  useEffect(() => {
    const timer = setTimeout(() => {
      onChange(localValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [localValue, onChange]);

  // Handle / key to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
        const target = e.target as HTMLElement;
        // Don't trigger if already in an input
        if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
          return;
        }
        e.preventDefault();
        document.getElementById("table-search-input")?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClear = () => {
    setLocalValue("");
    onClear();
  };

  return (
    <div className="p-3 border-b">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          id="table-search-input"
          placeholder="Search tables (press /)"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              handleClear();
              e.currentTarget.blur();
            }
          }}
          className="pl-8 pr-20 h-8 text-xs"
        />
        <div className="absolute right-1 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {matchCount !== undefined && localValue && (
            <span className="text-xs text-muted-foreground px-2">
              {matchCount}
            </span>
          )}
          {localValue && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={handleClear}
            >
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
