import { AlertCircle, Copy, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui";
import { copyToClipboard } from "@/lib/utils";
import { showErrorToast, showSuccessToast } from "@/lib/toast-helpers";

interface QueryErrorProps {
  error: string;
  onRetry?: () => void;
  className?: string;
}

/** A consistent, actionable error surface for failed database queries. */
export function QueryError({ error, onRetry, className }: QueryErrorProps) {
  const handleCopy = async () => {
    const copied = await copyToClipboard(error);
    if (copied) {
      showSuccessToast("Copied", "Query error copied to clipboard");
    } else {
      showErrorToast("Couldn't copy error");
    }
  };

  return (
    <div className={`flex h-full items-center justify-center p-4 ${className ?? ""}`} role="alert">
      <div className="w-full max-w-2xl rounded-lg border border-destructive/25 bg-destructive/5 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-destructive">Query failed</p>
            <details className="mt-2">
              <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                Show error details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-md border border-destructive/15 bg-background/75 p-2 text-xs text-foreground whitespace-pre-wrap break-words">
                {error}
              </pre>
            </details>
            <div className="mt-3 flex flex-wrap gap-2">
              {onRetry && (
                <Button size="sm" variant="outline" onClick={onRetry} className="h-7 gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" />
                  Retry
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={handleCopy} className="h-7 gap-1.5">
                <Copy className="h-3.5 w-3.5" />
                Copy error
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
