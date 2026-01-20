import { useState, useEffect } from "react";
import {
  Shield,
  ShieldCheck,
  ShieldX,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  XCircle,
  Info,
  Lock,
  Unlock,
  Server,
  Key,
  FileKey,
  RefreshCw,
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useDatabase } from "@/hooks/useDatabase";
import type { ConnectionConfig, SslTestResult, SslSupportInfo } from "@/types";

interface SslTestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConnectionConfig;
}

export function SslTestDialog({
  open,
  onOpenChange,
  config,
}: SslTestDialogProps) {
  const { testSslConnection, getSslSupportInfo } = useDatabase();
  const [testResult, setTestResult] = useState<SslTestResult | null>(null);
  const [supportInfo, setSupportInfo] = useState<SslSupportInfo | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load SSL support info when dialog opens
  useEffect(() => {
    if (open) {
      loadSupportInfo();
      // Auto-run test when dialog opens
      runTest();
    } else {
      // Reset state when dialog closes
      setTestResult(null);
      setError(null);
    }
  }, [open]);

  const loadSupportInfo = async () => {
    try {
      const allInfo = await getSslSupportInfo();
      const info = allInfo.find(
        (i) => i.databaseType === config.databaseType.toLowerCase()
      );
      setSupportInfo(info || null);
    } catch (err) {
      console.error("Failed to load SSL support info:", err);
    }
  };

  const runTest = async () => {
    setIsTesting(true);
    setError(null);
    setTestResult(null);

    try {
      const result = await testSslConnection(config);
      setTestResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Test failed");
    } finally {
      setIsTesting(false);
    }
  };

  const getSslStatusIcon = () => {
    if (!testResult) return <Shield className="h-8 w-8 text-muted-foreground" />;

    if (!testResult.supportsSsl) {
      return <ShieldAlert className="h-8 w-8 text-yellow-500" />;
    }

    if (testResult.success && testResult.sslEnabled) {
      return <ShieldCheck className="h-8 w-8 text-green-500" />;
    }

    if (testResult.success && !testResult.sslEnabled) {
      return <Unlock className="h-8 w-8 text-yellow-500" />;
    }

    return <ShieldX className="h-8 w-8 text-red-500" />;
  };

  const getSslStatusBadge = () => {
    if (!testResult) return null;

    if (!testResult.supportsSsl) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
          Not Supported
        </Badge>
      );
    }

    if (testResult.success && testResult.sslEnabled) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
          SSL Enabled
        </Badge>
      );
    }

    if (testResult.success && !testResult.sslEnabled) {
      return (
        <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
          SSL Disabled
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800">
        Connection Failed
      </Badge>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            SSL/TLS Connection Test
          </DialogTitle>
          <DialogDescription>
            Test the security of your database connection
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Status Header */}
          <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center gap-3">
              {isTesting ? (
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              ) : (
                getSslStatusIcon()
              )}
              <div>
                <p className="font-medium">
                  {isTesting
                    ? "Testing connection..."
                    : testResult?.success
                    ? testResult.sslEnabled
                      ? "Secure Connection"
                      : "Unencrypted Connection"
                    : testResult
                    ? "Connection Failed"
                    : "Ready to Test"}
                </p>
                <p className="text-sm text-muted-foreground">
                  {config.name || config.host || "Connection"}
                </p>
              </div>
            </div>
            {getSslStatusBadge()}
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
              <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Test Result Details */}
          {testResult && !isTesting && (
            <div className="space-y-3">
              <Separator />

              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
                <span className="text-sm">{testResult.message}</span>
              </div>

              {/* SSL Details */}
              {testResult.success && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {/* SSL Mode */}
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">SSL Mode</p>
                      <p className="font-medium">{testResult.sslMode || "N/A"}</p>
                    </div>
                  </div>

                  {/* Protocol Version */}
                  <div className="flex items-center gap-2 p-2 bg-muted/30 rounded">
                    <Shield className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Protocol</p>
                      <p className="font-medium">{testResult.protocolVersion || "N/A"}</p>
                    </div>
                  </div>

                  {/* Cipher Suite */}
                  {testResult.cipherSuite && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded col-span-2">
                      <Key className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Cipher Suite</p>
                        <p className="font-medium font-mono text-xs">{testResult.cipherSuite}</p>
                      </div>
                    </div>
                  )}

                  {/* Server Version */}
                  {testResult.serverVersion && (
                    <div className="flex items-center gap-2 p-2 bg-muted/30 rounded col-span-2">
                      <Server className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Server Version</p>
                        <p className="font-medium">{testResult.serverVersion}</p>
                      </div>
                    </div>
                  )}

                  {/* Certificate Info */}
                  {testResult.certificateInfo && (
                    <div className="flex items-start gap-2 p-2 bg-muted/30 rounded col-span-2">
                      <FileKey className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Certificate</p>
                        {testResult.certificateInfo.subject && (
                          <p className="font-medium text-xs">Subject: {testResult.certificateInfo.subject}</p>
                        )}
                        {testResult.certificateInfo.issuer && (
                          <p className="text-xs text-muted-foreground">Issuer: {testResult.certificateInfo.issuer}</p>
                        )}
                        {testResult.certificateInfo.validUntil && (
                          <p className="text-xs text-muted-foreground">Valid until: {testResult.certificateInfo.validUntil}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SSL Support Info */}
              {supportInfo && (
                <>
                  <Separator />
                  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-blue-700 dark:text-blue-300 mb-1">
                        {config.databaseType} SSL Support
                      </p>
                      <p className="text-blue-600 dark:text-blue-400 text-xs">
                        {supportInfo.notes}
                      </p>
                      <div className="flex gap-2 mt-2">
                        <Badge variant={supportInfo.supportsSsl ? "default" : "secondary"} className="text-xs">
                          {supportInfo.supportsSsl ? "SSL Supported" : "No SSL"}
                        </Badge>
                        {supportInfo.supportsCaCert && (
                          <Badge variant="outline" className="text-xs">CA Cert</Badge>
                        )}
                        {supportInfo.supportsClientCert && (
                          <Badge variant="outline" className="text-xs">Client Cert</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Current SSL Config */}
          {config.ssl && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="font-medium mb-2">Current SSL Configuration</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-muted/30 rounded">
                    <span className="text-muted-foreground">Mode: </span>
                    <span className="font-medium">{config.ssl.mode}</span>
                  </div>
                  {config.ssl.caCertPath && (
                    <div className="p-2 bg-muted/30 rounded col-span-2 truncate">
                      <span className="text-muted-foreground">CA Cert: </span>
                      <span className="font-medium font-mono">{config.ssl.caCertPath}</span>
                    </div>
                  )}
                  {config.ssl.clientCertPath && (
                    <div className="p-2 bg-muted/30 rounded col-span-2 truncate">
                      <span className="text-muted-foreground">Client Cert: </span>
                      <span className="font-medium font-mono">{config.ssl.clientCertPath}</span>
                    </div>
                  )}
                  {config.ssl.clientKeyPath && (
                    <div className="p-2 bg-muted/30 rounded col-span-2 truncate">
                      <span className="text-muted-foreground">Client Key: </span>
                      <span className="font-medium font-mono">{config.ssl.clientKeyPath}</span>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={runTest} disabled={isTesting}>
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Test Again
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
