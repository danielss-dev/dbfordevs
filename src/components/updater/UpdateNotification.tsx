import { useEffect, useState } from "react";
import * as ToastPrimitives from "@radix-ui/react-toast";
import { Download, X, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUpdaterStore } from "@/stores/updater";
import { useUIStore } from "@/stores/ui";
import { cn } from "@/lib/utils";

export function UpdateNotification() {
  const {
    available,
    downloading,
    progress,
    newVersion,
    dismissed,
    error,
    downloadAndInstall,
    dismissUpdate,
    checkForUpdates,
  } = useUpdaterStore();

  const { generalSettings } = useUIStore();
  const [open, setOpen] = useState(false);

  // Check for updates on mount if setting is enabled
  useEffect(() => {
    if (import.meta.env.DEV) {
      return;
    }

    if (!generalSettings.checkUpdatesOnStartup) {
      return;
    }

    const timer = setTimeout(() => {
      checkForUpdates();
    }, 3000);

    return () => clearTimeout(timer);
  }, [generalSettings.checkUpdatesOnStartup, checkForUpdates]);

  // Show toast when update is available and not dismissed
  useEffect(() => {
    if (available && !dismissed) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [available, dismissed]);

  const handleLater = () => {
    dismissUpdate();
    setOpen(false);
  };

  const handleInstall = () => {
    downloadAndInstall();
  };

  if (!available || dismissed) {
    return null;
  }

  return (
    <ToastPrimitives.Provider swipeDirection="right">
      <ToastPrimitives.Root
        open={open}
        onOpenChange={setOpen}
        duration={Infinity}
        className={cn(
          "group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-lg border p-4 pr-8 shadow-lg transition-all",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out",
          "data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full",
          "data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-bottom-full",
          "border-l-4 bg-background text-foreground border-l-primary"
        )}
      >
        <div className="flex gap-3 flex-1">
          <RefreshCw className="h-5 w-5 shrink-0 text-primary" />
          <div className="grid gap-1 flex-1">
            <ToastPrimitives.Title className="text-sm font-semibold">
              Update Available
            </ToastPrimitives.Title>
            <ToastPrimitives.Description className="text-sm opacity-90">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : downloading ? (
                <span className="flex items-center gap-2">
                  {progress === -1 ? "Downloading..." : `Downloading... ${progress}%`}
                </span>
              ) : (
                <span>Version {newVersion} is ready to install.</span>
              )}
            </ToastPrimitives.Description>
            {downloading && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary mt-2">
                <div
                  className={cn(
                    "h-full bg-primary transition-all duration-300",
                    progress === -1 && "animate-pulse w-full"
                  )}
                  style={progress >= 0 ? { width: `${progress}%` } : undefined}
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLater}
            disabled={downloading}
            className="h-8"
          >
            Later
          </Button>
          <Button
            size="sm"
            onClick={handleInstall}
            disabled={downloading}
            variant={error ? "destructive" : "default"}
            className="h-8"
          >
            {downloading ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Installing
              </>
            ) : error ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                Retry
              </>
            ) : (
              <>
                <Download className="mr-1.5 h-3.5 w-3.5" />
                Install
              </>
            )}
          </Button>
        </div>

        <ToastPrimitives.Close
          className={cn(
            "absolute right-2 top-2 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity",
            "hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-2 group-hover:opacity-100"
          )}
          onClick={handleLater}
        >
          <X className="h-4 w-4" />
        </ToastPrimitives.Close>
      </ToastPrimitives.Root>

      <ToastPrimitives.Viewport
        className={cn(
          "fixed top-0 z-[100] flex max-h-screen w-full flex-col-reverse p-4",
          "sm:bottom-0 sm:right-0 sm:top-auto sm:flex-col md:max-w-[420px]"
        )}
      />
    </ToastPrimitives.Provider>
  );
}
