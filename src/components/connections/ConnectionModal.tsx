import { useState, useEffect, useMemo } from "react";
import { Loader2, CheckCircle2, XCircle, Database, HelpCircle, Server, Key, FolderOpen, Link2, Shield, Terminal, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { open } from "@tauri-apps/plugin-dialog";
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
  BrandIcon,
} from "@/components/ui";
import { Separator } from "@/components/ui/separator";
import { useUIStore } from "@/stores";
import { useDatabase } from "@/hooks";
import type { ConnectionConfig, DatabaseType, SslMode, SslConfig, SshTunnelConfig } from "@/types";
import { parseConnectionString } from "@/lib/connection-string-parser";
import { cn } from "@/lib/utils";
import { DATABASE_DEFAULTS, DATABASE_METADATA } from "@/lib/constants";

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
  connectionString: undefined,
  useConnectionString: false,
  ssl: undefined,
  sshTunnel: undefined,
};

const SSL_MODES: { value: SslMode; label: string; description: string }[] = [
  { value: "disable", label: "Disable", description: "No SSL encryption" },
  { value: "prefer", label: "Prefer", description: "Use SSL if available" },
  { value: "require", label: "Require", description: "Require SSL connection" },
  { value: "verify-ca", label: "Verify CA", description: "Verify server certificate" },
  { value: "verify-full", label: "Verify Full", description: "Verify certificate and hostname" },
];

const DEFAULT_SSL_CONFIG: SslConfig = {
  mode: "disable",
  caCertPath: undefined,
  clientCertPath: undefined,
  clientKeyPath: undefined,
};

const DEFAULT_SSH_CONFIG: SshTunnelConfig = {
  enabled: false,
  host: "",
  port: 22,
  username: "",
  authMethod: "password",
  password: undefined,
  privateKeyPath: undefined,
  passphrase: undefined,
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

interface CollapsibleSectionProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function CollapsibleSection({ icon, title, subtitle, isOpen, onToggle, children }: CollapsibleSectionProps) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onToggle}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full"
      >
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {icon}
        <span>{title}</span>
        {subtitle && <span className="text-xs ml-2 opacity-70">{subtitle}</span>}
      </button>
      {isOpen && <div className="pl-6 space-y-4">{children}</div>}
    </div>
  );
}

interface FilePickerInputProps {
  id: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  filters?: { name: string; extensions: string[] }[];
}

function FilePickerInput({ id, value, onChange, placeholder, filters }: FilePickerInputProps) {
  const handleBrowse = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: filters || [{ name: "All Files", extensions: ["*"] }],
      });
      if (selected) {
        onChange(selected as string);
      }
    } catch (error) {
      console.error("File picker error:", error);
    }
  };

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        placeholder={placeholder}
        value={value || ""}
        onChange={(e) => onChange(e.target.value || undefined)}
        className="transition-colors font-mono text-sm flex-1"
      />
      <Button type="button" variant="outline" size="icon" onClick={handleBrowse}>
        <FolderOpen className="h-4 w-4" />
      </Button>
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
  const [sslSectionOpen, setSslSectionOpen] = useState(false);
  const [sshSectionOpen, setSshSectionOpen] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);

  const isEditMode = editingConnectionId !== null;
  const defaults = useMemo(() => DATABASE_DEFAULTS[formData.databaseType], [formData.databaseType]);
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
              port: config.port === DATABASE_DEFAULTS[config.databaseType].port ? undefined : config.port,
              username: config.username === DATABASE_DEFAULTS[config.databaseType].username ? "" : config.username,
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
      setSslSectionOpen(false);
      setSshSectionOpen(false);
      setParseError(null);
    }
  }, [showConnectionModal]);

  // Clear test result when form changes
  useEffect(() => {
    if (testResult) {
      setTestResult(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.host, formData.port, formData.username, formData.password, formData.database, formData.filePath, formData.databaseType, formData.ssl, formData.sshTunnel]);

  // Handle connection string parsing
  const handleParseConnectionString = () => {
    if (!formData.connectionString?.trim()) {
      setParseError("Connection string is empty");
      return;
    }

    try {
      const parsed = parseConnectionString(formData.connectionString.trim());
      setFormData({
        ...formData,
        databaseType: parsed.databaseType || formData.databaseType,
        host: parsed.host || "",
        port: parsed.port,
        database: parsed.database || "",
        username: parsed.username || "",
        password: parsed.password || "",
        sslMode: parsed.sslMode,
      });
      setParseError(null);
    } catch (error) {
      setParseError(error instanceof Error ? error.message : "Failed to parse connection string");
    }
  };

  // Helper to update SSL config
  const updateSslConfig = (updates: Partial<SslConfig>) => {
    setFormData({
      ...formData,
      ssl: {
        ...(formData.ssl || DEFAULT_SSL_CONFIG),
        ...updates,
      },
    });
  };

  // Helper to update SSH config
  const updateSshConfig = (updates: Partial<SshTunnelConfig>) => {
    setFormData({
      ...formData,
      sshTunnel: {
        ...(formData.sshTunnel || DEFAULT_SSH_CONFIG),
        ...updates,
      },
    });
  };

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
            <BrandIcon
              name={DATABASE_METADATA[formData.databaseType].brand}
              className={cn("h-5 w-5", DATABASE_METADATA[formData.databaseType].color)}
            />
            {isEditMode ? "Edit Connection" : "New Connection"}
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
                    {(Object.keys(DATABASE_METADATA) as DatabaseType[]).map((type) => (
                      <SelectItem key={type} value={type}>
                        <span className="flex items-center gap-2">
                          <BrandIcon name={DATABASE_METADATA[type].brand} className={cn("h-4 w-4", DATABASE_METADATA[type].color)} />
                          <span>{DATABASE_METADATA[type].name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            </Section>

            <Separator />

            {/* Connection String Section - Only for non-SQLite */}
            {!isSqlite && (
              <Section icon={<Link2 className="h-4 w-4" />} title="Connection Method">
                <div className="flex items-center gap-4 mb-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="connectionMethod"
                      checked={!formData.useConnectionString}
                      onChange={() => setFormData({ ...formData, useConnectionString: false })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Individual Fields</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="connectionMethod"
                      checked={formData.useConnectionString === true}
                      onChange={() => setFormData({ ...formData, useConnectionString: true })}
                      className="h-4 w-4"
                    />
                    <span className="text-sm">Connection String</span>
                  </label>
                </div>

                {formData.useConnectionString && (
                  <div className="space-y-4">
                    <FormField
                      label="Connection String"
                      htmlFor="connectionString"
                      hint="Paste your database connection string (e.g., postgresql://user:pass@host:port/db)"
                    >
                      <textarea
                        id="connectionString"
                        placeholder={formData.databaseType === "mssql"
                          ? "Server=tcp:host,port;Database=db;User Id=user;Password=pass;"
                          : `${formData.databaseType}://user:password@host:port/database`}
                        value={formData.connectionString || ""}
                        onChange={(e) => {
                          setFormData({ ...formData, connectionString: e.target.value });
                          setParseError(null);
                        }}
                        className="w-full min-h-[80px] px-3 py-2 text-sm font-mono rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                      />
                    </FormField>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleParseConnectionString}
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Parse & Fill Fields
                      </Button>
                      {parseError && (
                        <span className="text-sm text-red-500">{parseError}</span>
                      )}
                    </div>
                  </div>
                )}
              </Section>
            )}

            {!isSqlite && formData.useConnectionString && <Separator />}

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

                <Separator />

                {/* SSL/TLS Section */}
                <CollapsibleSection
                  icon={<Shield className="h-4 w-4" />}
                  title="SSL/TLS"
                  subtitle={formData.ssl?.mode && formData.ssl.mode !== "disable" ? `(${formData.ssl.mode})` : undefined}
                  isOpen={sslSectionOpen}
                  onToggle={() => setSslSectionOpen(!sslSectionOpen)}
                >
                  <FormField
                    label="SSL Mode"
                    htmlFor="sslMode"
                    hint="Choose the level of SSL/TLS encryption for your connection"
                  >
                    <Select
                      value={formData.ssl?.mode || "disable"}
                      onValueChange={(value) => updateSslConfig({ mode: value as SslMode })}
                    >
                      <SelectTrigger id="sslMode" className="transition-colors">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SSL_MODES.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value}>
                            <div className="flex flex-col">
                              <span>{mode.label}</span>
                              <span className="text-xs text-muted-foreground">{mode.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>

                  {formData.ssl?.mode && formData.ssl.mode !== "disable" && (
                    <>
                      <FormField
                        label="CA Certificate"
                        htmlFor="caCert"
                        hint="Path to the Certificate Authority (CA) certificate file"
                      >
                        <FilePickerInput
                          id="caCert"
                          value={formData.ssl?.caCertPath}
                          onChange={(value) => updateSslConfig({ caCertPath: value })}
                          placeholder="/path/to/ca-certificate.pem"
                          filters={[{ name: "Certificates", extensions: ["pem", "crt", "cer"] }]}
                        />
                      </FormField>

                      <FormField
                        label="Client Certificate"
                        htmlFor="clientCert"
                        hint="Path to the client certificate file (optional, for mutual TLS)"
                      >
                        <FilePickerInput
                          id="clientCert"
                          value={formData.ssl?.clientCertPath}
                          onChange={(value) => updateSslConfig({ clientCertPath: value })}
                          placeholder="/path/to/client-certificate.pem"
                          filters={[{ name: "Certificates", extensions: ["pem", "crt", "cer"] }]}
                        />
                      </FormField>

                      <FormField
                        label="Client Key"
                        htmlFor="clientKey"
                        hint="Path to the client private key file (optional, for mutual TLS)"
                      >
                        <FilePickerInput
                          id="clientKey"
                          value={formData.ssl?.clientKeyPath}
                          onChange={(value) => updateSslConfig({ clientKeyPath: value })}
                          placeholder="/path/to/client-key.pem"
                          filters={[{ name: "Keys", extensions: ["pem", "key"] }]}
                        />
                      </FormField>
                    </>
                  )}
                </CollapsibleSection>

                <Separator />

                {/* SSH Tunnel Section */}
                <CollapsibleSection
                  icon={<Terminal className="h-4 w-4" />}
                  title="SSH Tunnel"
                  subtitle={formData.sshTunnel?.enabled ? "(enabled)" : undefined}
                  isOpen={sshSectionOpen}
                  onToggle={() => setSshSectionOpen(!sshSectionOpen)}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <input
                      type="checkbox"
                      id="sshEnabled"
                      checked={formData.sshTunnel?.enabled || false}
                      onChange={(e) => updateSshConfig({ enabled: e.target.checked })}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <Label htmlFor="sshEnabled" className="text-sm cursor-pointer">
                      Connect through SSH tunnel
                    </Label>
                  </div>

                  {formData.sshTunnel?.enabled && (
                    <>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <FormField
                            label="SSH Host"
                            htmlFor="sshHost"
                            hint="SSH server hostname or IP address"
                            required
                          >
                            <Input
                              id="sshHost"
                              placeholder="ssh.example.com"
                              value={formData.sshTunnel?.host || ""}
                              onChange={(e) => updateSshConfig({ host: e.target.value })}
                              className="transition-colors"
                            />
                          </FormField>
                        </div>
                        <FormField
                          label="SSH Port"
                          htmlFor="sshPort"
                          hint="Default: 22"
                        >
                          <Input
                            id="sshPort"
                            type="number"
                            placeholder="22"
                            value={formData.sshTunnel?.port || ""}
                            onChange={(e) =>
                              updateSshConfig({
                                port: e.target.value ? parseInt(e.target.value, 10) : 22,
                              })
                            }
                            className="transition-colors"
                          />
                        </FormField>
                      </div>

                      <FormField
                        label="SSH Username"
                        htmlFor="sshUsername"
                        hint="Username for SSH authentication"
                        required
                      >
                        <Input
                          id="sshUsername"
                          placeholder="ubuntu"
                          value={formData.sshTunnel?.username || ""}
                          onChange={(e) => updateSshConfig({ username: e.target.value })}
                          className="transition-colors"
                        />
                      </FormField>

                      <div className="flex items-center gap-4 mb-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sshAuthMethod"
                            checked={formData.sshTunnel?.authMethod === "password"}
                            onChange={() => updateSshConfig({ authMethod: "password" })}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Password</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="sshAuthMethod"
                            checked={formData.sshTunnel?.authMethod === "privateKey"}
                            onChange={() => updateSshConfig({ authMethod: "privateKey" })}
                            className="h-4 w-4"
                          />
                          <span className="text-sm">Private Key</span>
                        </label>
                      </div>

                      {formData.sshTunnel?.authMethod === "password" ? (
                        <FormField
                          label="SSH Password"
                          htmlFor="sshPassword"
                          hint="Password for SSH authentication"
                        >
                          <Input
                            id="sshPassword"
                            type="password"
                            placeholder="SSH password"
                            value={formData.sshTunnel?.password || ""}
                            onChange={(e) => updateSshConfig({ password: e.target.value })}
                            className="transition-colors"
                          />
                        </FormField>
                      ) : (
                        <>
                          <FormField
                            label="Private Key"
                            htmlFor="sshPrivateKey"
                            hint="Path to your SSH private key file (e.g., ~/.ssh/id_rsa)"
                          >
                            <FilePickerInput
                              id="sshPrivateKey"
                              value={formData.sshTunnel?.privateKeyPath}
                              onChange={(value) => updateSshConfig({ privateKeyPath: value })}
                              placeholder="~/.ssh/id_rsa"
                              filters={[{ name: "SSH Keys", extensions: ["pem", "key", "*"] }]}
                            />
                          </FormField>

                          <FormField
                            label="Passphrase"
                            htmlFor="sshPassphrase"
                            hint="Passphrase for encrypted private keys (leave empty if not encrypted)"
                          >
                            <Input
                              id="sshPassphrase"
                              type="password"
                              placeholder="Key passphrase (optional)"
                              value={formData.sshTunnel?.passphrase || ""}
                              onChange={(e) => updateSshConfig({ passphrase: e.target.value })}
                              className="transition-colors"
                            />
                          </FormField>
                        </>
                      )}
                    </>
                  )}
                </CollapsibleSection>
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
