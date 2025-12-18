import { useState, useEffect } from "react";
import {
  Database,
  Loader2,
  Copy,
  Check,
  Globe,
  Hash,
  User,
  Lock,
  FileText,
  Fingerprint,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui";
import { useDatabase } from "@/hooks";
import { useConnectionsStore } from "@/stores";
import type { ConnectionConfig, DatabaseType } from "@/types";

const DB_CONFIG: Record<DatabaseType, { name: string; icon: string; color: string; bgColor: string }> = {
  postgresql: { name: "PostgreSQL", icon: "🐘", color: "text-blue-500", bgColor: "bg-blue-500/10" },
  mysql: { name: "MySQL", icon: "🐬", color: "text-orange-500", bgColor: "bg-orange-500/10" },
  sqlite: { name: "SQLite", icon: "📁", color: "text-green-500", bgColor: "bg-green-500/10" },
  mssql: { name: "SQL Server", icon: "🗄️", color: "text-red-500", bgColor: "bg-red-500/10" },
};

interface PropertyItemProps {
  icon: React.ReactNode;
  label: string;
  value: string | number | undefined;
  isSensitive?: boolean;
  mono?: boolean;
}

function PropertyItem({ icon, label, value, isSensitive, mono }: PropertyItemProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(String(value));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const displayValue = isSensitive && value ? "••••••••" : (value ?? "—");

  return (
    <div className="flex items-center gap-3 py-2.5 px-2 group">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted/50 text-muted-foreground shrink-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0 overflow-hidden">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p
          className={`text-sm ${mono ? "font-mono text-xs break-all" : "font-medium truncate"}`}
          title={String(value ?? "")}
        >
          {displayValue}
        </p>
      </div>
      {value && !isSensitive && (
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          onClick={handleCopy}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </Button>
      )}
    </div>
  );
}

interface ConnectionPropertiesDialogProps {
  connectionId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectionPropertiesDialog({
  connectionId,
  open,
  onOpenChange,
}: ConnectionPropertiesDialogProps) {
  const { getConnection } = useDatabase();
  const { connections } = useConnectionsStore();
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<ConnectionConfig | null>(null);

  const connectionInfo = connections.find((c) => c.id === connectionId);
  const isConnected = connectionInfo?.connected ?? false;

  useEffect(() => {
    if (open && connectionId) {
      setIsLoading(true);
      getConnection(connectionId)
        .then((data) => setConfig(data))
        .finally(() => setIsLoading(false));
    } else if (!open) {
      setConfig(null);
    }
  }, [open, connectionId, getConnection]);

  const isSqlite = config?.databaseType === "sqlite";
  const dbConfig = config ? DB_CONFIG[config.databaseType] : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[400px] w-[calc(100vw-2rem)] p-0 gap-0 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : config && dbConfig ? (
          <>
            {/* Header with database type */}
            <div className={`${dbConfig.bgColor} px-5 py-4`}>
              <div className="flex items-center gap-3">
                <div className="text-3xl shrink-0">{dbConfig.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-lg font-semibold truncate">{config.name}</h2>
                    <div
                      className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                        isConnected
                          ? "bg-green-500/20 text-green-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {isConnected ? "Connected" : "Disconnected"}
                    </div>
                  </div>
                  <p className={`text-sm ${dbConfig.color}`}>{dbConfig.name}</p>
                </div>
              </div>
            </div>

            {/* Properties */}
            <div className="px-5 py-4 space-y-1">
              {!isSqlite ? (
                <>
                  {/* Server Section */}
                  <div className="pb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Server
                    </p>
                    <div className="space-y-0.5 rounded-lg border bg-card p-1">
                      <PropertyItem
                        icon={<Globe className="h-4 w-4" />}
                        label="Host"
                        value={config.host || "localhost"}
                      />
                      <PropertyItem
                        icon={<Hash className="h-4 w-4" />}
                        label="Port"
                        value={config.port}
                        mono
                      />
                      <PropertyItem
                        icon={<Database className="h-4 w-4" />}
                        label="Database"
                        value={config.database}
                      />
                    </div>
                  </div>

                  {/* Authentication Section */}
                  <div className="pb-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Authentication
                    </p>
                    <div className="space-y-0.5 rounded-lg border bg-card p-1">
                      <PropertyItem
                        icon={<User className="h-4 w-4" />}
                        label="Username"
                        value={config.username}
                      />
                      <PropertyItem
                        icon={<Lock className="h-4 w-4" />}
                        label="Password"
                        value={config.password}
                        isSensitive
                      />
                    </div>
                  </div>
                </>
              ) : (
                /* SQLite Section */
                <div className="pb-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Database File
                  </p>
                  <div className="space-y-0.5 rounded-lg border bg-card p-1">
                    <PropertyItem
                      icon={<FileText className="h-4 w-4" />}
                      label="File Path"
                      value={config.filePath}
                      mono
                    />
                  </div>
                </div>
              )}

              {/* Connection ID */}
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Identifier
                </p>
                <div className="rounded-lg border bg-card p-1">
                  <PropertyItem
                    icon={<Fingerprint className="h-4 w-4" />}
                    label="Connection ID"
                    value={config.id}
                    mono
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            Connection not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
