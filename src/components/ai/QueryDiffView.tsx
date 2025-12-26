import { useState, useMemo } from "react";
import { Check, X, Copy, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { QueryDiff } from "@/extensions/ai/types";

interface QueryDiffViewProps {
  diff: QueryDiff;
  onApply?: (optimizedSql: string) => void;
  onDismiss?: () => void;
}

// Simplified diff algorithm for SQL
function computeDiff(original: string, optimized: string): Array<{ type: "unchanged" | "removed" | "added"; text: string }> {
  const originalLines = original.split("\n");
  const optimizedLines = optimized.split("\n");
  const result: Array<{ type: "unchanged" | "removed" | "added"; text: string }> = [];

  let i = 0;
  let j = 0;

  while (i < originalLines.length || j < optimizedLines.length) {
    if (i >= originalLines.length) {
      // Remaining lines are added
      result.push({ type: "added", text: optimizedLines[j] });
      j++;
    } else if (j >= optimizedLines.length) {
      // Remaining lines are removed
      result.push({ type: "removed", text: originalLines[i] });
      i++;
    } else if (originalLines[i].trim() === optimizedLines[j].trim()) {
      // Lines are the same (ignoring whitespace)
      result.push({ type: "unchanged", text: optimizedLines[j] });
      i++;
      j++;
    } else {
      // Lines differ - check if it's a modification or insertion/deletion
      const nextOriginalMatch = optimizedLines.slice(j + 1, j + 5).findIndex(
        line => line.trim() === originalLines[i].trim()
      );
      const nextOptimizedMatch = originalLines.slice(i + 1, i + 5).findIndex(
        line => line.trim() === optimizedLines[j].trim()
      );

      if (nextOriginalMatch !== -1 && (nextOptimizedMatch === -1 || nextOriginalMatch <= nextOptimizedMatch)) {
        // Lines were added
        for (let k = 0; k <= nextOriginalMatch; k++) {
          result.push({ type: "added", text: optimizedLines[j + k] });
        }
        j += nextOriginalMatch + 1;
      } else if (nextOptimizedMatch !== -1) {
        // Lines were removed
        for (let k = 0; k <= nextOptimizedMatch; k++) {
          result.push({ type: "removed", text: originalLines[i + k] });
        }
        i += nextOptimizedMatch + 1;
      } else {
        // Lines changed - show as remove then add
        result.push({ type: "removed", text: originalLines[i] });
        result.push({ type: "added", text: optimizedLines[j] });
        i++;
        j++;
      }
    }
  }

  return result;
}

export function QueryDiffView({ diff, onApply, onDismiss }: QueryDiffViewProps) {
  const [copied, setCopied] = useState(false);

  const diffLines = useMemo(() => {
    return computeDiff(diff.original, diff.optimized);
  }, [diff.original, diff.optimized]);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(diff.optimized);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-border bg-background overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/50 border-b border-border">
        <div className="flex items-center gap-2">
          <ArrowRight className="h-4 w-4 text-violet-400" />
          <span className="font-medium text-sm">Query Optimization</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={copyToClipboard}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Copy
          </Button>
          {onApply && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-green-500 hover:text-green-600"
              onClick={() => onApply(diff.optimized)}
            >
              <Check className="h-3.5 w-3.5" />
              Apply
            </Button>
          )}
          {onDismiss && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-red-500 hover:text-red-600"
              onClick={onDismiss}
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </Button>
          )}
        </div>
      </div>

      {/* Changes summary */}
      {diff.changes && diff.changes.length > 0 && (
        <div className="px-4 py-2 bg-violet-500/5 border-b border-border">
          <p className="text-xs font-medium text-violet-400 mb-1">Changes:</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {diff.changes.map((change, i) => (
              <li key={i} className="flex items-start gap-1">
                <span className="text-violet-400 mt-0.5">-</span>
                <span>{change}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Diff view */}
      <div className="p-4 overflow-x-auto bg-[#1e1e2e]">
        <pre className="font-mono text-xs leading-relaxed">
          {diffLines.map((line, i) => (
            <div
              key={i}
              className={cn(
                "px-2 -mx-2",
                line.type === "removed" && "bg-red-500/20 text-red-300",
                line.type === "added" && "bg-green-500/20 text-green-300",
                line.type === "unchanged" && "text-gray-300"
              )}
            >
              <span className="inline-block w-4 text-right mr-2 opacity-50">
                {line.type === "removed" ? "-" : line.type === "added" ? "+" : " "}
              </span>
              {line.text || " "}
            </div>
          ))}
        </pre>
      </div>

      {/* Side by side comparison (collapsed by default) */}
      <details className="border-t border-border">
        <summary className="px-4 py-2 text-xs text-muted-foreground cursor-pointer hover:bg-muted/50">
          Show side-by-side comparison
        </summary>
        <div className="grid grid-cols-2 gap-2 p-4">
          <div>
            <p className="text-xs font-medium text-red-400 mb-2">Original</p>
            <pre className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-xs font-mono whitespace-pre-wrap text-red-200">
              {diff.original}
            </pre>
          </div>
          <div>
            <p className="text-xs font-medium text-green-400 mb-2">Optimized</p>
            <pre className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-xs font-mono whitespace-pre-wrap text-green-200">
              {diff.optimized}
            </pre>
          </div>
        </div>
      </details>
    </div>
  );
}
