import { useState, useEffect, useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Database, HelpCircle, Server, Key, FolderOpen, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/stores";
import { useDatabase } from "@/hooks";
import type { ConnectionConfig, DatabaseType } from "@/types";

// Database-specific defaults
const DB_DEFAULTS: Record<DatabaseType, { port: number; username: string; host: string }> = {
  postgresql: { port: 5432, username: "postgres", host: "localhost" },
  mysql: { port: 3306, username: "root", host: "localhost" },
  sqlite: { port: 0, username: "", host: "" },
  mssql: { port: 1433, username: "sa", host: "localhost" },
};

const DB_LABELS: Record<DatabaseType, { name: string; icon: string }> = {
  postgresql: { name: "PostgreSQL", icon: "🐘" },
  mysql: { name: "MySQL", icon: "🐬" },
  sqlite: { name: "SQLite", icon: "📁" },
  mssql: { name: "SQL Server", icon: "🗄️" },
};

const INITIAL_FORM_DATA: ConnectionConfig = {
  name: "",
  databaseType: "postgresql",
  host: "",
  port: undefined,
  database: "",
  username: "",
  password: "",
  sslMode: undefined,
  filePath: undefined,
};

interface FormFieldProps {
  label: string;
  htmlFor: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

function FormField({ label, htmlFor, hint, required, children }: FormFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={htmlFor} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </Label>
        {hint && (
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <p>{hint}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      {children}
    </div>
  );
}

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        {icon}
        <span>{title}</span>
      </div>
      <div className="pl-6 space-y-4">{children}</div>
    </div>
  );
}

export function ConnectionModal() {
  const { showConnectionModal, editingConnectionId, setShowConnectionModal } = useUIStore();
  const { saveConnection, testConnection, getConnection } = useDatabase();
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string; serverVersion?: string } | null>(null);

  const [formData, setFormData] = useState<ConnectionConfig>(INITIAL_FORM_DATA);

  const isEditMode = editingConnectionId !== null;
  const defaults = useMemo(() => DB_DEFAULTS[formData.databaseType], [formData.databaseType]);
  const isSqlite = formData.databaseType === "sqlite";

  // Get effective values (use placeholder defaults when field is empty)
  const getEffectiveConfig = (): ConnectionConfig => ({
    ...formData,
    id: editingConnectionId ?? undefined,
    host: formData.host || defaults.host,
    port: formData.port || defaults.port,
    username: formData.username || defaults.username,
  });

  // Load connection data when editing
  useEffect(() => {
    if (showConnectionModal && editingConnectionId) {
      setIsLoading(true);
      getConnection(editingConnectionId)
        .then((config) => {
          if (config) {
            setFormData({
              ...config,
              // Show actual values, not defaults
              host: config.host === defaults.host ? "" : config.host,
              port: config.port === DB_DEFAULTS[config.databaseType].port ? undefined : config.port,
              username: config.username === DB_DEFAULTS[config.databaseType].username ? "" : config.username,
            });
          }
        })
        .finally(() => setIsLoading(false));
    }
  }, [showConnectionModal, editingConnectionId, getConnection]);

  // Reset form when modal closes
  useEffect(() => {
    if (!showConnectionModal) {
      setFormData(INITIAL_FORM_DATA);
      setTestResult(null);
      setIsSaving(false);
      setIsTesting(false);
      setIsLoading(false);
    }
  }, [showConnectionModal]);

  // Clear test result when form changes
  useEffect(() => {
    if (testResult) {
      setTestResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.host, formData.port, formData.username, formData.password, formData.database, formData.filePath, formData.databaseType]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const effectiveConfig = getEffectiveConfig();
      const result = await testConnection(effectiveConfig);
      setTestResult({
        success: result.success,
        message: result.message,
        serverVersion: result.serverVersion,
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const effectiveConfig = getEffectiveConfig();
      const result = await saveConnection(effectiveConfig);
      if (result) {
        setShowConnectionModal(false);
      }
    } catch (error) {
      console.error("Failed to save connection:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const canTest = formData.name.trim() && (isSqlite ? formData.filePath?.trim() : formData.database.trim());
  const canSave = canTest && testResult?.success;

  return (
    <Dialog open={showConnectionModal} onOpenChange={setShowConnectionModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <Pencil className="h-5 w-5" />
                Edit Connection
              </>
            ) : (
              <>
                <Database className="h-5 w-5" />
                New Connection
              </>
            )}
          </DialogTitle>
          <DialogDescription>
            {isEditMode
              ? "Update your connection settings. Test the connection before saving changes."
              : "Configure a new database connection. Test before saving to ensure connectivity."}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Basic Info Section */}
            <Section icon={<Database className="h-4 w-4" />} title="Basic Information">
              <FormField
                label="Connection Name"
                htmlFor="name"
                hint="A friendly name to identify this connection"
                required
              >
                <Input
                  id="name"
                  placeholder="Production Database"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="transition-colors focus:ring-2"
                />
              </FormField>

              <FormField
                label="Database Type"
                htmlFor="databaseType"
                hint="Select the type of database you want to connect to"
                required
              >
                <Select
                  value={formData.databaseType}
                  onValueChange={(value) => {
                    const dbType = value as DatabaseType;
                    setFormData({
                      ...formData,
                      databaseType: dbType,
                      port: undefined, // Reset to use new defaults
                      username: "", // Reset to use new defaults
                    });
                  }}
                >
                  <SelectTrigger id="databaseType" className="transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(DB_LABELS) as DatabaseType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center gap-2">
                          <span>{DB_LABELS[type].icon}</span>
                          <span>{DB_LABELS[type].name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </Section>

            <Separator />

            {!isSqlite ? (
              <>
                {/* Server Section */}
                <Section icon={<Server className="h-4 w-4" />} title="Server">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <FormField
                        label="Host"
                        htmlFor="host"
                        hint="Server hostname or IP address. Leave empty to use localhost."
                      >
                        <Input
                          id="host"
                          placeholder={defaults.host}
                          value={formData.host || ""}
                          onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                          className="transition-colors"
                        />
                      </FormField>
                    </div>
                    <FormField
                      label="Port"
                      htmlFor="port"
                      hint={`Default: ${defaults.port}`}
                    >
                      <Input
                        id="port"
                        type="number"
                        placeholder={String(defaults.port)}
                        value={formData.port || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            port: e.target.value ? parseInt(e.target.value, 10) : undefined,
                          })
                        }
                        className="transition-colors"
                      />
                    </FormField>
                  </div>

                  <FormField
                    label="Database Name"
                    htmlFor="database"
                    hint="The name of the database to connect to"
                    required
                  >
                    <Input
                      id="database"
                      placeholder="mydb"
                      value={formData.database}
                      onChange={(e) => setFormData({ ...formData, database: e.target.value })}
                      className="transition-colors"
                    />
                  </FormField>
                </Section>

                <Separator />

                {/* Authentication Section */}
                <Section icon={<Key className="h-4 w-4" />} title="Authentication">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      label="Username"
                      htmlFor="username"
                      hint={`Leave empty to use default: ${defaults.username}`}
                    >
                      <Input
                        id="username"
                        placeholder={defaults.username}
                        value={formData.username || ""}
                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                        className="transition-colors"
                      />
                    </FormField>
                    <FormField
                      label="Password"
                      htmlFor="password"
                      hint={isEditMode ? "Leave empty to keep existing password" : "Your database password"}
                    >
                      <Input
                        id="password"
                        type="password"
                        placeholder={isEditMode ? "••••••••" : "Password"}
                        value={formData.password || ""}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="transition-colors"
                      />
                    </FormField>
                  </div>
                </Section>
              </>
            ) : (
              /* SQLite File Section */
              <Section icon={<FolderOpen className="h-4 w-4" />} title="Database File">
                <FormField
                  label="File Path"
                  htmlFor="filePath"
                  hint="Full path to your SQLite database file"
                  required
                >
                  <Input
                    id="filePath"
                    placeholder="/path/to/database.db"
                    value={formData.filePath || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        filePath: e.target.value,
                        database: e.target.value.split("/").pop()?.replace(/\.[^/.]+$/, "") || "",
                      })
                    }
                    className="transition-colors font-mono text-sm"
                  />
                </FormField>
                <p className="text-xs text-muted-foreground">
                  If the file doesn't exist, it will be created when you first connect.
                </p>
              </Section>
            )}

            {/* Test Result */}
            {testResult && (
              <div
                className={`flex items-start gap-3 rounded-lg border p-4 transition-all ${
                  testResult.success
                    ? "border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/50"
                    : "border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/50"
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1 min-w-0">
                  <p className={`text-sm font-medium ${
                    testResult.success
                      ? "text-green-900 dark:text-green-100"
                      : "text-red-900 dark:text-red-100"
                  }`}>
                    {testResult.success ? "Connection successful!" : "Connection failed"}
                  </p>
                  <p className={`text-sm ${
                    testResult.success
                      ? "text-green-700 dark:text-green-300"
                      : "text-red-700 dark:text-red-300"
                  }`}>
                    {testResult.message}
                  </p>
                  {testResult.success && testResult.serverVersion && (
                    <p className="text-xs text-green-600 dark:text-green-400 font-mono">
                      Server: {testResult.serverVersion}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setShowConnectionModal(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={handleTest}
            disabled={isTesting || !canTest || isLoading}
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    onClick={handleSave}
                    disabled={!canSave || isSaving || isLoading}
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : isEditMode ? (
                      "Update Connection"
                    ) : (
                      "Save Connection"
                    )}
                  </Button>
                </span>
              </TooltipTrigger>
              {!canSave && (
                <TooltipContent>
                  <p>{!testResult ? "Test the connection first" : "Connection test must pass"}</p>
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
