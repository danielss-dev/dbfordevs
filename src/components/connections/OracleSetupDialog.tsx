import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AlertTriangle,
  Download,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Info,
  RotateCcw,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BrandIcon } from "@/components/ui";
import type { OracleClientStatus, OracleDownloadInfo, OracleDownloadProgress } from "@/types";

interface OracleSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSetupComplete?: () => void;
}

export function OracleSetupDialog({
  open,
  onOpenChange,
  onSetupComplete,
}: OracleSetupDialogProps) {
  const [status, setStatus] = useState<OracleClientStatus | null>(null);
  const [downloadInfo, setDownloadInfo] = useState<OracleDownloadInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState<OracleDownloadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justInstalled, setJustInstalled] = useState(false);

  // Load Oracle client status when dialog opens
  useEffect(() => {
    if (open) {
      loadStatus();
    }
  }, [open]);

  // Listen for download progress events
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    if (isDownloading) {
      listen<OracleDownloadProgress>("oracle-setup-progress", (event) => {
        setProgress(event.payload);
        if (event.payload.stage === "complete") {
          setIsDownloading(false);
          setJustInstalled(true);
          loadStatus();
          onSetupComplete?.();
        } else if (event.payload.stage === "error") {
          setIsDownloading(false);
          setError(event.payload.message);
        }
      }).then((fn) => {
        unlisten = fn;
      });
    }

    return () => {
      unlisten?.();
    };
  }, [isDownloading, onSetupComplete]);

  const loadStatus = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [clientStatus, info] = await Promise.all([
        invoke<OracleClientStatus>("check_oracle_client_status"),
        invoke<OracleDownloadInfo>("get_oracle_download_info"),
      ]);
      setStatus(clientStatus);
      setDownloadInfo(info);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check Oracle client status");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setError(null);
    setProgress({
      stage: "downloading",
      progress: 0,
      message: "Starting download...",
    });

    try {
      await invoke<OracleClientStatus>("download_oracle_client");
    } catch (err) {
      setIsDownloading(false);
      setError(err instanceof Error ? err.message : "Download failed");
    }
  };

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-8 gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Checking Oracle client status...</p>
        </div>
      );
    }

    if (status?.isInstalled) {
      return (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/50 p-4">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">
                Oracle Instant Client is installed
              </p>
              {status.installPath && (
                <p className="text-xs text-green-700 dark:text-green-300 font-mono">
                  {status.installPath}
                </p>
              )}
              {status.version && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  Version: {status.version}
                </p>
              )}
            </div>
          </div>

          {/* Restart required message */}
          {justInstalled && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                  Restart Required
                </p>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  The application needs to be restarted to load the Oracle client libraries.
                </p>
                <Button
                  size="sm"
                  onClick={() => relaunch()}
                  className="mt-2"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Restart Now
                </Button>
              </div>
            </div>
          )}

          {!justInstalled && (
            <p className="text-sm text-muted-foreground">
              You can now connect to Oracle databases. Close this dialog and try connecting again.
            </p>
          )}
        </div>
      );
    }

    if (isDownloading) {
      return (
        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{progress?.message || "Downloading..."}</span>
              <span className="font-mono">{progress?.progress.toFixed(0)}%</span>
            </div>
            <Progress value={progress?.progress || 0} className="h-2" />
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Please wait while Oracle Instant Client is being downloaded and installed.
            This may take a few minutes depending on your connection speed.
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Warning Banner */}
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/50 p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
              Oracle Instant Client Required
            </p>
            <p className="text-sm text-amber-700 dark:text-amber-300">
              To connect to Oracle databases, you need to install Oracle Instant Client.
              This is a requirement from Oracle for connecting to their databases.
            </p>
          </div>
        </div>

        {/* Info Section */}
        <div className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <strong>What is Oracle Instant Client?</strong>
              </p>
              <p>
                Oracle Instant Client is a free set of libraries that enables applications
                to connect to Oracle databases. It's required by Oracle's licensing terms.
              </p>
            </div>
          </div>

          {downloadInfo && (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                <p className="text-muted-foreground">Download Size</p>
                <p className="font-medium">{downloadInfo.size}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/30 space-y-1">
                <p className="text-muted-foreground">Install Location</p>
                <p className="font-mono text-xs truncate" title={downloadInfo.installPath}>
                  {downloadInfo.installPath}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50 p-4">
            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">
                Setup Failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-3">
          <Button
            onClick={handleDownload}
            className="w-full"
            size="lg"
          >
            <Download className="h-4 w-4 mr-2" />
            Download & Install Oracle Instant Client
          </Button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={() => window.open("https://www.oracle.com/database/technologies/instant-client/downloads.html", "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            Download Manually from Oracle
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            If you prefer to install manually, download the "Basic" or "Basic Light" package
            and add it to your system PATH.
          </p>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BrandIcon name="oracle" className="h-5 w-5 text-red-600" />
            Oracle Database Setup
          </DialogTitle>
          <DialogDescription>
            Additional setup is required to connect to Oracle databases.
          </DialogDescription>
        </DialogHeader>

        {renderContent()}

        <DialogFooter>
          {status?.isInstalled ? (
            <Button onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDownloading}>
              Cancel
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Hook to check if an error message indicates missing Oracle client
 */
export function isOracleClientError(errorMessage: string): boolean {
  return (
    errorMessage.includes("DPI-1047") ||
    errorMessage.includes("Cannot locate") ||
    errorMessage.includes("Oracle Client library") ||
    (errorMessage.includes("OCI") && errorMessage.includes("not found"))
  );
}
