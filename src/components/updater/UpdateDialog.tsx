import { Download, RefreshCw, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdater } from "@/hooks/useUpdater";

export function UpdateDialog() {
  const {
    available,
    downloading,
    progress,
    error,
    currentVersion,
    newVersion,
    downloadAndInstall,
    dismissUpdate,
  } = useUpdater();

  if (!available) return null;

  return (
    <Dialog open={available} onOpenChange={(open) => !open && dismissUpdate()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-primary" />
            Update Available
          </DialogTitle>
          <DialogDescription>
            A new version of dbfordevs is available.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Current version:</span>
            <span className="font-mono">{currentVersion}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">New version:</span>
            <span className="font-mono text-primary">{newVersion}</span>
          </div>

          {downloading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Downloading...</span>
                <span className="font-mono">{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={dismissUpdate} disabled={downloading}>
            <X className="mr-2 h-4 w-4" />
            Later
          </Button>
          <Button onClick={downloadAndInstall} disabled={downloading}>
            {downloading ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Installing...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Update Now
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
