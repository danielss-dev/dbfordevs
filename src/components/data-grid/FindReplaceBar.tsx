import * as React from "react";
import {
  Search,
  Replace,
  ChevronUp,
  ChevronDown,
  X,
  CaseSensitive,
  WholeWord,
  Regex,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGridStore } from "@/stores/grid";
import type { ColumnInfo, FindMatch } from "@/types";
import { cn } from "@/lib/utils";

interface FindReplaceBarProps {
  columns: ColumnInfo[];
  data: Record<string, unknown>[];
  onReplace?: (
    columnId: string,
    rowIndex: number,
    oldValue: unknown,
    newValue: string
  ) => void;
  onReplaceAll?: (
    matches: FindMatch[],
    replaceText: string
  ) => void;
}

export function FindReplaceBar({
  columns,
  data,
  onReplace,
  onReplaceAll,
}: FindReplaceBarProps) {
  const {
    findReplace,
    closeFindReplace,
    setFindText,
    setReplaceText,
    setFindOptions,
    setFindColumn,
    setMatches,
    nextMatch,
    prevMatch,
  } = useGridStore();

  const findInputRef = React.useRef<HTMLInputElement>(null);
  const [showReplace, setShowReplace] = React.useState(false);

  // Focus input when opening
  React.useEffect(() => {
    if (findReplace.isOpen) {
      setTimeout(() => findInputRef.current?.focus(), 50);
    }
  }, [findReplace.isOpen]);

  // Perform search when find text or options change
  React.useEffect(() => {
    if (!findReplace.findText) {
      setMatches([]);
      return;
    }

    const matches: FindMatch[] = [];
    const { findText, matchCase, wholeWord, useRegex, selectedColumn } = findReplace;

    let pattern: RegExp;
    try {
      if (useRegex) {
        pattern = new RegExp(findText, matchCase ? "g" : "gi");
      } else {
        const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const wordBoundary = wholeWord ? `\\b${escaped}\\b` : escaped;
        pattern = new RegExp(wordBoundary, matchCase ? "g" : "gi");
      }
    } catch {
      // Invalid regex
      setMatches([]);
      return;
    }

    data.forEach((row, rowIndex) => {
      const columnsToSearch = selectedColumn
        ? columns.filter((c) => c.name === selectedColumn)
        : columns;

      columnsToSearch.forEach((col) => {
        const value = row[col.name];
        if (value === null || value === undefined) return;

        const strValue = typeof value === "object"
          ? JSON.stringify(value)
          : String(value);

        let match;
        while ((match = pattern.exec(strValue)) !== null) {
          matches.push({
            rowIndex,
            columnId: col.name,
            startPos: match.index,
            endPos: match.index + match[0].length,
            value: match[0],
          });
        }
      });
    });

    setMatches(matches);
  }, [
    findReplace.findText,
    findReplace.matchCase,
    findReplace.wholeWord,
    findReplace.useRegex,
    findReplace.selectedColumn,
    columns,
    data,
    setMatches,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      closeFindReplace();
    } else if (e.key === "Enter") {
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    } else if (e.key === "F3") {
      e.preventDefault();
      if (e.shiftKey) {
        prevMatch();
      } else {
        nextMatch();
      }
    }
  };

  const handleReplace = () => {
    if (!onReplace || findReplace.matches.length === 0) return;
    const match = findReplace.matches[findReplace.currentMatchIndex];
    if (!match) return;

    const row = data[match.rowIndex];
    const oldValue = row[match.columnId];

    onReplace(
      match.columnId,
      match.rowIndex,
      oldValue,
      findReplace.replaceText
    );
  };

  const handleReplaceAll = () => {
    if (!onReplaceAll || findReplace.matches.length === 0) return;
    onReplaceAll(findReplace.matches, findReplace.replaceText);
  };

  if (!findReplace.isOpen) return null;

  const { matches, currentMatchIndex, findText, replaceText, matchCase, wholeWord, useRegex, selectedColumn } = findReplace;

  return (
    <div
      className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-2 py-1.5"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2">
        {/* Toggle replace mode */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            showReplace && "bg-accent"
          )}
          onClick={() => setShowReplace(!showReplace)}
          title="Toggle Replace (Ctrl+H)"
        >
          <Replace className="h-4 w-4" />
        </Button>

        {/* Find input */}
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={findInputRef}
            value={findText}
            onChange={(e) => setFindText(e.target.value)}
            placeholder="Find..."
            className="pl-8 h-7 text-sm"
          />
        </div>

        {/* Column selector */}
        <Select
          value={selectedColumn || "all"}
          onValueChange={(v) => setFindColumn(v === "all" ? null : v)}
        >
          <SelectTrigger className="h-7 w-32 text-xs">
            <SelectValue placeholder="All columns" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All columns</SelectItem>
            {columns.map((col) => (
              <SelectItem key={col.name} value={col.name}>
                {col.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Options toggles */}
        <div className="flex items-center gap-0.5">
          <Toggle
            size="sm"
            pressed={matchCase}
            onPressedChange={(v: boolean) => setFindOptions({ matchCase: v })}
            className="h-7 w-7 p-0"
            title="Match Case"
          >
            <CaseSensitive className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={wholeWord}
            onPressedChange={(v: boolean) => setFindOptions({ wholeWord: v })}
            className="h-7 w-7 p-0"
            title="Match Whole Word"
          >
            <WholeWord className="h-4 w-4" />
          </Toggle>
          <Toggle
            size="sm"
            pressed={useRegex}
            onPressedChange={(v: boolean) => setFindOptions({ useRegex: v })}
            className="h-7 w-7 p-0"
            title="Use Regular Expression"
          >
            <Regex className="h-4 w-4" />
          </Toggle>
        </div>

        {/* Match navigation */}
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground min-w-[60px] text-center">
            {matches.length > 0
              ? `${currentMatchIndex + 1} of ${matches.length}`
              : findText
              ? "No results"
              : ""}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={prevMatch}
            disabled={matches.length === 0}
            title="Previous Match (Shift+Enter)"
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={nextMatch}
            disabled={matches.length === 0}
            title="Next Match (Enter)"
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>

        {/* Close button */}
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={closeFindReplace}
          title="Close (Escape)"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Replace row */}
      {showReplace && (
        <div className="flex items-center gap-2 mt-1.5 pl-9">
          <div className="relative flex-1 max-w-sm">
            <Replace className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Replace with..."
              className="pl-8 h-7 text-sm"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleReplace}
            disabled={matches.length === 0 || !onReplace}
          >
            Replace
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={handleReplaceAll}
            disabled={matches.length === 0 || !onReplaceAll}
          >
            Replace All ({matches.length})
          </Button>
        </div>
      )}
    </div>
  );
}
