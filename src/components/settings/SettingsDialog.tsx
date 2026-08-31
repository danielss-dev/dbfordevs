import {
  Badge,
  Dialog,
  DialogContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  ScrollArea,
  Button,
  Input,
  Checkbox,
} from "@/components/ui";
import { useUIStore, useUpdaterStore, useQueryStore, useThemesStore } from "@/stores";
import { useToast } from "@/hooks/useToast";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState, useMemo } from "react";
import { ThemeManagerDialog } from "@/components/themes";
import { KeybindingEditor } from "./KeybindingEditor";
import {
  Desktop,
  Moon,
  Sun,
  Keyboard,
  User,
  Code,
  Info,
  ArrowSquareOut,
  GithubLogo,
  MagnifyingGlass,
  ArrowCounterClockwise,
  Gear,
  X,
  Sparkle,
  Robot,
  DownloadSimple,
  ArrowsClockwise,
  Table,
  Eye,
  Palette,
  Wrench,
} from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { useAIStore } from "@/lib/ai/store";
import { DbForDevsIcon } from "@/components/icons";
import { GridSettingsTab } from "./GridSettingsTab";

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 px-3 py-2.5">
      <div className="space-y-0.5">
        <Label className="text-[13px] font-medium">{label}</Label>
        <p className="text-[11px] text-muted-foreground max-w-[280px]">{description}</p>
      </div>
      {children}
    </div>
  );
}


interface GeneralTabProps {
  generalSettings: {
    checkUpdatesOnStartup: boolean;
    sendAnalytics: boolean;
    enableAnimations: boolean;
  };
  handleGeneralSettingChange: (key: "checkUpdatesOnStartup" | "sendAnalytics" | "enableAnimations", value: boolean) => void;
}

function GeneralTab({ generalSettings, handleGeneralSettingChange }: GeneralTabProps) {
  const {
    available,
    checking,
    downloading,
    progress,
    newVersion,
    error,
    checkForUpdates,
    downloadAndInstall,
  } = useUpdaterStore();

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-sm font-medium mb-0.5">General</h2>
        <p className="text-xs text-muted-foreground">Manage your application preferences.</p>
      </div>

      <div className="rounded-md border border-border">
        <SettingRow
          label="Check for updates on startup"
          description="Automatically check for new versions when the app launches."
        >
          <Checkbox
            checked={generalSettings.checkUpdatesOnStartup}
            onCheckedChange={(checked: boolean) =>
              handleGeneralSettingChange("checkUpdatesOnStartup", checked)
            }
          />
        </SettingRow>

        {/* Update section */}
        <Separator />
        <div className="flex items-center justify-between gap-4 px-3 py-2.5">
          <div className="space-y-0.5">
            <Label className="text-[13px] font-medium">Software Update</Label>
            <p className="text-[11px] text-muted-foreground max-w-[280px]">
              {error ? (
                <span className="text-destructive">{error}</span>
              ) : available ? (
                `Version ${newVersion} is available.`
              ) : (
                "You're running the latest version."
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {available ? (
              <Button
                size="sm"
                onClick={() => downloadAndInstall()}
                disabled={downloading}
                variant={error ? "destructive" : "default"}
              >
                {downloading ? (
                  <>
                    <ArrowsClockwise weight="regular" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    {progress === -1 ? "Downloading..." : `Installing ${progress}%`}
                  </>
                ) : error ? (
                  <>
                    <ArrowsClockwise weight="regular" className="mr-1.5 h-3.5 w-3.5" />
                    Retry Update
                  </>
                ) : (
                  <>
                    <DownloadSimple weight="regular" className="mr-1.5 h-3.5 w-3.5" />
                    Update Now
                  </>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => checkForUpdates()}
                disabled={checking}
              >
                {checking ? (
                  <>
                    <ArrowsClockwise weight="regular" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Checking...
                  </>
                ) : (
                  <>
                    <ArrowsClockwise weight="regular" className="mr-1.5 h-3.5 w-3.5" />
                    Check for Updates
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        <Separator />
        <SettingRow
          label="Send analytics data"
          description="Help us improve by sending anonymous usage data."
        >
          <Checkbox
            checked={generalSettings.sendAnalytics}
            onCheckedChange={(checked: boolean) =>
              handleGeneralSettingChange("sendAnalytics", checked)
            }
          />
        </SettingRow>
      </div>
    </div>
  );
}

type TabValue = "general" | "ai" | "editor" | "datagrid" | "appearance" | "keybindings" | "advanced" | "about";

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { value: "general", label: "General", icon: <User weight="regular" className="h-3.5 w-3.5" /> },
  { value: "ai", label: "AI Assistant", icon: <Robot weight="regular" className="h-3.5 w-3.5" /> },
  { value: "editor", label: "Editor", icon: <Code weight="regular" className="h-3.5 w-3.5" /> },
  { value: "datagrid", label: "Data Grid", icon: <Table weight="regular" className="h-3.5 w-3.5" /> },
  { value: "appearance", label: "Appearance", icon: <Sun weight="regular" className="h-3.5 w-3.5" /> },
  { value: "keybindings", label: "Keybindings", icon: <Keyboard weight="regular" className="h-3.5 w-3.5" /> },
  { value: "advanced", label: "Advanced", icon: <Gear weight="regular" className="h-3.5 w-3.5" /> },
  { value: "about", label: "About", icon: <Info weight="regular" className="h-3.5 w-3.5" /> },
];

interface SettingItem {
  label: string;
  description: string;
  keywords: string[];
  tabValue: TabValue;
}

const ALL_SETTINGS: SettingItem[] = [
  // General
  { label: "Check for updates on startup", description: "Automatically check for new versions when the app launches.", keywords: ["check", "update", "startup", "version"], tabValue: "general" },
  { label: "Send analytics data", description: "Help us improve by sending anonymous usage data.", keywords: ["analytics", "data", "send", "usage"], tabValue: "general" },
  // Editor
  { label: "Font Family", description: "The font used in the SQL editor.", keywords: ["font", "family", "typeface", "editor"], tabValue: "editor" },
  { label: "Font Size", description: "Adjust the text size in the editor (pixels).", keywords: ["font", "size", "text", "editor", "px", "pixels"], tabValue: "editor" },
  { label: "Tab Size", description: "Number of spaces per tab indentation.", keywords: ["tab", "size", "indent", "spaces"], tabValue: "editor" },
  { label: "Line Numbers", description: "Show line numbers on the left side.", keywords: ["line", "number", "gutter"], tabValue: "editor" },
  { label: "Word Wrap", description: "Wrap lines that exceed viewport width.", keywords: ["word", "wrap", "lines", "width"], tabValue: "editor" },
  { label: "Show Invisibles", description: "Display spaces, tabs, and line endings.", keywords: ["invisible", "spaces", "tabs", "endings", "whitespace"], tabValue: "editor" },
  // SQL Formatter
  { label: "SQL Formatter", description: "Configure SQL code formatting options.", keywords: ["sql", "format", "formatter", "beautify", "beautifier", "pretty"], tabValue: "editor" },
  { label: "Keyword Case", description: "How SQL keywords are formatted.", keywords: ["keyword", "case", "upper", "lower", "format"], tabValue: "editor" },
  { label: "Indentation Width", description: "Number of spaces for indentation.", keywords: ["indent", "width", "spaces", "tab"], tabValue: "editor" },
  { label: "Use Tabs", description: "Use tabs instead of spaces.", keywords: ["tabs", "spaces", "indent"], tabValue: "editor" },
  { label: "Indent Style", description: "How clauses are indented.", keywords: ["indent", "style", "tabular"], tabValue: "editor" },
  { label: "Dense Operators", description: "Remove spaces around operators.", keywords: ["dense", "operators", "compact"], tabValue: "editor" },
  // Data Grid
  { label: "Row Height", description: "Default height for rows in the data grid.", keywords: ["row", "height", "grid", "display", "compact"], tabValue: "datagrid" },
  { label: "Date Format", description: "How dates are displayed in cells.", keywords: ["date", "format", "iso", "locale", "time"], tabValue: "datagrid" },
  { label: "Number Format", description: "How numeric values are displayed.", keywords: ["number", "format", "decimal", "thousands", "separator"], tabValue: "datagrid" },
  { label: "NULL Display", description: "How NULL values are shown.", keywords: ["null", "display", "empty", "badge"], tabValue: "datagrid" },
  { label: "JSON Display", description: "How JSON objects are shown in cells.", keywords: ["json", "display", "collapsed", "pretty"], tabValue: "datagrid" },
  { label: "Conditional Formatting", description: "Highlight cells based on their values.", keywords: ["conditional", "format", "highlight", "color", "rules"], tabValue: "datagrid" },
  { label: "Binary Data", description: "Preview options for binary data.", keywords: ["binary", "hex", "image", "blob"], tabValue: "datagrid" },
  // Appearance
  { label: "Theme", description: "Switch between light, dark, or system theme.", keywords: ["theme", "light", "dark", "system", "color"], tabValue: "appearance" },
  { label: "Density", description: "Row height and spacing in lists, menus, and the connection tree.", keywords: ["density", "compact", "relaxed", "spacing", "row", "height"], tabValue: "appearance" },
  { label: "Environment Accent", description: "Tint the accent color to the active connection's group color.", keywords: ["environment", "accent", "production", "staging", "group", "color", "safety"], tabValue: "appearance" },
  { label: "Enable Animations", description: "Enable smooth animations throughout the interface.", keywords: ["animation", "animations", "smooth", "motion", "transition", "effects"], tabValue: "appearance" },
  // Keybindings
  { label: "Keyboard Shortcuts", description: "Master dbfordevs with these handy keys.", keywords: ["keyboard", "shortcut", "key", "binding", "find", "replace", "search", "shortcuts"], tabValue: "keybindings" },
  // Advanced
  { label: "Developer Mode", description: "Enable additional debugging information and console logging.", keywords: ["developer", "debug", "mode", "console"], tabValue: "advanced" },
  { label: "Debug Logging", description: "Log detailed information to help troubleshoot issues.", keywords: ["debug", "log", "logging", "troubleshoot"], tabValue: "advanced" },
  { label: "Reset all settings", description: "Restore all settings to their default values.", keywords: ["reset", "default", "restore"], tabValue: "advanced" },
  { label: "Clear cache", description: "Clear cached data and temporary files.", keywords: ["cache", "clear", "temporary", "files"], tabValue: "advanced" },
  // Query History
  { label: "Query History", description: "Configure how query history is stored and cleaned up.", keywords: ["query", "history", "cleanup", "storage"], tabValue: "advanced" },
  { label: "Auto-cleanup enabled", description: "Automatically remove old queries based on age and count limits.", keywords: ["auto", "cleanup", "history", "automatic"], tabValue: "advanced" },
  { label: "Maximum history items", description: "Maximum number of queries to keep per connection.", keywords: ["max", "history", "items", "limit", "queries"], tabValue: "advanced" },
  { label: "Delete queries older than", description: "Automatically remove queries older than this many days.", keywords: ["delete", "old", "days", "history", "retention"], tabValue: "advanced" },
];

export function SettingsDialog() {
  const {
    showSettingsDialog,
    setShowSettingsDialog,
    theme,
    setTheme,
    density,
    setDensity,
    editorSettings,
    updateEditorSettings,
    generalSettings,
    updateGeneralSettings,
    formatterSettings,
    updateFormatterSettings,
    settingsDialogTab,
  } = useUIStore();
  const { toast } = useToast();
  const { customThemes } = useThemesStore();
  const [version, setVersion] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabValue>(settingsDialogTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showThemeManager, setShowThemeManager] = useState(false);

  useEffect(() => {
    getVersion().then(setVersion).catch(console.error);
  }, []);

  useEffect(() => {
    setActiveTab(settingsDialogTab);
  }, [settingsDialogTab]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape" && searchOpen) {
        setSearchOpen(false);
      }
    };

    if (showSettingsDialog) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [showSettingsDialog, searchOpen]);

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme as any);

    // Get label from built-in themes or custom themes
    const builtInLabels: Record<string, string> = {
      system: "System",
      light: "Light",
      dark: "Dark",
      "classic-light": "Classic Light",
      "classic-dark": "Classic Dark",
      "nordic-dark": "Nordic Dark",
      "nordic-light": "Nordic Light",
      "solarized-dark": "Solarized Dark",
      "solarized-light": "Solarized Light",
      "one-dark": "One Dark",
      "high-contrast": "High Contrast",
    };

    let label = builtInLabels[newTheme];

    // Check if it's a custom theme
    if (newTheme.startsWith("custom:")) {
      const customThemeId = newTheme.replace("custom:", "");
      const customTheme = customThemes.find((t) => t.id === customThemeId);
      label = customTheme?.name || "Custom Theme";
    }

    toast({
      title: "Theme updated",
      description: `Interface theme set to ${label}.`,
    });
  };

  const handleEditorSettingChange = (key: keyof typeof editorSettings, value: any) => {
    updateEditorSettings({ [key]: value });
    toast({
      title: "Editor setting updated",
      description: `${key} has been changed.`,
    });
  };

  const handleGeneralSettingChange = (key: keyof typeof generalSettings, value: any) => {
    updateGeneralSettings({ [key]: value });
    toast({
      title: "Setting updated",
      description: `${key} has been changed.`,
    });
  };

  const handleFormatterSettingChange = (key: keyof typeof formatterSettings, value: any) => {
    updateFormatterSettings({ [key]: value });
    toast({
      title: "Formatter setting updated",
      description: `SQL formatting preference has been changed.`,
    });
  };

  // Filter tabs based on search query by searching all settings
  const filteredTabs = useMemo(() => {
    if (!searchQuery.trim()) {
      return TABS;
    }

    const query = searchQuery.toLowerCase();

    // Find all settings that match the search query
    const matchingSettings = ALL_SETTINGS.filter((setting) =>
      setting.label.toLowerCase().includes(query) ||
      setting.description.toLowerCase().includes(query) ||
      setting.keywords.some((kw) => kw.toLowerCase().includes(query))
    );

    // Get unique tab values from matching settings
    const matchingTabValues = new Set(matchingSettings.map((s) => s.tabValue));

    // Include tabs that match by their label as well
    return TABS.filter(
      (tab) =>
        matchingTabValues.has(tab.value) ||
        tab.label.toLowerCase().includes(query)
    );
  }, [searchQuery]);

  // Auto-switch to first filtered tab if current tab is not in filtered list
  useEffect(() => {
    if (searchQuery && filteredTabs.length > 0) {
      if (!filteredTabs.some((t) => t.value === activeTab)) {
        setActiveTab(filteredTabs[0].value);
      }
    }
  }, [searchQuery, filteredTabs, activeTab]);

  return (
    <>
    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <DialogContent className="max-w-4xl gap-0 p-0 overflow-hidden sm:rounded h-[640px]">
        <div className="flex h-full w-full flex-col overflow-hidden">
          <div className="flex h-8 items-center border-b border-border px-3">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Settings
            </span>
          </div>

          <div className="flex flex-1 overflow-hidden">
            <div className="w-48 border-r border-border bg-sidebar flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 px-1.5 py-1.5">
                <nav className="space-y-0.5">
                  {filteredTabs.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setActiveTab(tab.value);
                      }}
                      className={cn(
                        "relative w-full flex items-center gap-2 px-2 py-1.5 rounded text-[13px] justify-start",
                        "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        activeTab === tab.value && "bg-[hsl(var(--sel))] text-primary"
                      )}
                    >
                      {activeTab === tab.value && (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-3.5 w-[2px] -translate-y-1/2 rounded-full bg-primary"
                        />
                      )}
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </ScrollArea>

              <div className="border-t border-border p-1.5">
                {searchOpen ? (
                  <div className="relative flex items-center gap-1">
                    <Input
                      placeholder="Search settings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="h-7 text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <X weight="regular" className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex h-7 w-full items-center gap-1.5 rounded border border-border px-2 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    onClick={() => setSearchOpen(true)}
                  >
                    <MagnifyingGlass weight="regular" className="h-3 w-3" />
                    <span className="flex-1 text-left">Search…</span>
                    <kbd>⌘F</kbd>
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden bg-background">
              <ScrollArea className="flex-1">
                <div className="p-5 max-w-2xl">
                  {/* General Tab */}
                  {activeTab === "general" && (
                    <GeneralTab
                      generalSettings={generalSettings}
                      handleGeneralSettingChange={handleGeneralSettingChange}
                    />
                  )}

                  {/* AI Assistant Tab */}
                  {activeTab === "ai" && (() => {
                    const { settings, updateSettings } = useAIStore.getState();

                    return (
                      <div className="space-y-4 animate-fade-in">
                        <div>
                          <h2 className="text-sm font-medium mb-0.5">AI Assistant</h2>
                          <p className="text-xs text-muted-foreground">
                            Configure AI-powered SQL generation and assistance.
                          </p>
                        </div>

                        <div className="rounded-md border border-border">
                          <SettingRow
                            label="Enable AI Assistant"
                            description="Enable or disable the AI Assistant feature throughout the application."
                          >
                            <Checkbox
                              checked={settings.aiEnabled ?? true}
                              onCheckedChange={(checked: boolean) => {
                                updateSettings({ aiEnabled: checked });
                                toast({
                                  title: checked ? "AI Assistant enabled" : "AI Assistant disabled",
                                  description: checked
                                    ? "You can now use AI features in the application."
                                    : "AI features have been disabled.",
                                });
                              }}
                            />
                          </SettingRow>
                        </div>

                        {settings.aiEnabled && (
                          <>
                            <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
                              <div className="flex items-start gap-2.5">
                                <Robot weight="regular" className="h-4 w-4 text-muted-foreground mt-0.5" />
                                <div className="flex-1 space-y-1">
                                  <h3 className="font-medium text-[13px]">Configure AI Settings</h3>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                                    Open the
                                    <Sparkle weight="regular" className="inline h-3 w-3 mx-1 text-primary" />
                                    AI Assistant panel in the rail, then use its settings icon to set provider, API keys, and model.
                                  </p>
                                </div>
                              </div>
                            </div>

                            {(() => {
                              const { historySettings, updateHistorySettings } = useAIStore.getState();

                              return (
                                <div className="rounded-md border border-border">
                                  <div className="px-3 py-2 border-b border-border">
                                    <h3 className="micro-label">Chat History Cleanup</h3>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                      Automatically manage your chat history storage
                                    </p>
                                  </div>

                                  <SettingRow
                                    label="Auto-cleanup on startup"
                                    description="Automatically remove old chats when the app opens"
                                  >
                                    <Checkbox
                                      checked={historySettings.cleanupOnStartup}
                                      onCheckedChange={(checked: boolean) => {
                                        updateHistorySettings({ cleanupOnStartup: checked });
                                        toast({
                                          title: checked ? "Auto-cleanup enabled" : "Auto-cleanup disabled",
                                          description: checked
                                            ? "Old chats will be cleaned up on app startup."
                                            : "Auto-cleanup has been disabled.",
                                        });
                                      }}
                                    />
                                  </SettingRow>

                                  <Separator />

                                  <SettingRow
                                    label="Delete chats older than (days)"
                                    description="Automatically remove chats older than this many days"
                                  >
                                    <Input
                                      type="number"
                                      min="1"
                                      max="365"
                                      value={historySettings.maxDaysOld}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (!isNaN(value) && value > 0) {
                                          updateHistorySettings({ maxDaysOld: value });
                                        }
                                      }}
                                      className="w-20"
                                    />
                                  </SettingRow>

                                  <Separator />

                                  <SettingRow
                                    label="Keep maximum chats"
                                    description="Maximum number of chats to keep (most recent)"
                                  >
                                    <Input
                                      type="number"
                                      min="10"
                                      max="500"
                                      value={historySettings.maxChatCount}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value);
                                        if (!isNaN(value) && value >= 10) {
                                          updateHistorySettings({ maxChatCount: value });
                                        }
                                      }}
                                      className="w-20"
                                    />
                                  </SettingRow>

                                  <div className="px-4 py-3 bg-muted/30">
                                    <p className="text-xs text-muted-foreground">
                                      <strong>Note:</strong> Favorited chats are never deleted during auto-cleanup.
                                    </p>
                                  </div>
                                </div>
                              );
                            })()}
                          </>
                        )}
                      </div>
                    );
                  })()}

                  {/* Editor Tab */}
                  {activeTab === "editor" && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <h2 className="text-sm font-medium mb-0.5">Editor</h2>
                        <p className="text-xs text-muted-foreground">Configure the SQL editor experience.</p>
                      </div>

                      <div className="rounded-md border border-border">
                        <SettingRow
                          label="Font Family"
                          description="The font used in the SQL editor."
                        >
                          <Select
                            value={editorSettings.fontFamily}
                            onValueChange={(value) => handleEditorSettingChange("fontFamily", value)}
                          >
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="JetBrains Mono">JetBrains Mono</SelectItem>
                              <SelectItem value="Fira Code">Fira Code</SelectItem>
                              <SelectItem value="Cascadia Code">Cascadia Code</SelectItem>
                              <SelectItem value="Source Code Pro">Source Code Pro</SelectItem>
                              <SelectItem value="Courier New">Courier New</SelectItem>
                            </SelectContent>
                          </Select>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Font Size"
                          description="Adjust the text size in the editor (pixels)."
                        >
                          <div className="flex items-center gap-3">
                            <Input
                              type="number"
                              value={editorSettings.fontSize}
                              onChange={(e) =>
                                handleEditorSettingChange("fontSize", parseInt(e.target.value))
                              }
                              className="w-20"
                              min={8}
                              max={24}
                            />
                            <span className="text-sm text-muted-foreground">px</span>
                          </div>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Tab Size"
                          description="Number of spaces per tab indentation."
                        >
                          <Input
                            type="number"
                            value={editorSettings.tabSize}
                            onChange={(e) =>
                              handleEditorSettingChange("tabSize", parseInt(e.target.value))
                            }
                            className="w-20"
                            min={1}
                            max={8}
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Line Numbers"
                          description="Show line numbers on the left side."
                        >
                          <Checkbox
                            checked={editorSettings.lineNumbers}
                            onCheckedChange={(checked: boolean) =>
                              handleEditorSettingChange("lineNumbers", checked)
                            }
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Word Wrap"
                          description="Wrap lines that exceed viewport width."
                        >
                          <Checkbox
                            checked={editorSettings.wordWrap}
                            onCheckedChange={(checked: boolean) =>
                              handleEditorSettingChange("wordWrap", checked)
                            }
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Show Invisibles"
                          description="Display spaces, tabs, and line endings."
                        >
                          <Checkbox
                            checked={editorSettings.showInvisibles}
                            onCheckedChange={(checked: boolean) =>
                              handleEditorSettingChange("showInvisibles", checked)
                            }
                          />
                        </SettingRow>
                      </div>

                      {/* SQL Formatter Settings */}
                      <div className="pt-2">
                        <h3 className="micro-label mb-1">SQL Formatter</h3>
                        <p className="text-[11px] text-muted-foreground mb-3">
                          Configure how SQL is formatted when using Shift+Alt+F or the Format button.
                        </p>
                      </div>

                      <div className="rounded-md border border-border">
                        <SettingRow
                          label="Keyword Case"
                          description="How SQL keywords like SELECT, FROM, WHERE are formatted."
                        >
                          <Select
                            value={formatterSettings.keywordCase}
                            onValueChange={(value) => handleFormatterSettingChange("keywordCase", value)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="upper">UPPERCASE</SelectItem>
                              <SelectItem value="lower">lowercase</SelectItem>
                              <SelectItem value="preserve">Preserve</SelectItem>
                            </SelectContent>
                          </Select>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Indentation Width"
                          description="Number of spaces for each indentation level."
                        >
                          <Input
                            type="number"
                            value={formatterSettings.tabWidth}
                            onChange={(e) =>
                              handleFormatterSettingChange("tabWidth", parseInt(e.target.value))
                            }
                            className="w-20"
                            min={1}
                            max={8}
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Use Tabs"
                          description="Use tabs instead of spaces for indentation."
                        >
                          <Checkbox
                            checked={formatterSettings.useTabs}
                            onCheckedChange={(checked: boolean) =>
                              handleFormatterSettingChange("useTabs", checked)
                            }
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Indent Style"
                          description="How clauses are indented relative to keywords."
                        >
                          <Select
                            value={formatterSettings.indentStyle}
                            onValueChange={(value) => handleFormatterSettingChange("indentStyle", value)}
                          >
                            <SelectTrigger className="w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="standard">Standard</SelectItem>
                              <SelectItem value="tabularLeft">Tabular Left</SelectItem>
                              <SelectItem value="tabularRight">Tabular Right</SelectItem>
                            </SelectContent>
                          </Select>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Dense Operators"
                          description="Remove spaces around operators (e.g., a=b instead of a = b)."
                        >
                          <Checkbox
                            checked={formatterSettings.denseOperators}
                            onCheckedChange={(checked: boolean) =>
                              handleFormatterSettingChange("denseOperators", checked)
                            }
                          />
                        </SettingRow>
                      </div>
                    </div>
                  )}

                  {/* Data Grid Tab */}
                  {activeTab === "datagrid" && <GridSettingsTab />}

                  {/* Appearance Tab */}
                  {activeTab === "appearance" && (
                    <div className="space-y-4 animate-fade-in">
                      <div>
                        <h2 className="text-sm font-medium mb-0.5">Appearance</h2>
                        <p className="text-xs text-muted-foreground">Customize how dbfordevs looks on your screen.</p>
                      </div>

                      <div className="rounded-md border border-border">
                        <SettingRow
                          label="Theme"
                          description="Choose a color theme for the interface."
                        >
                          <Select value={theme} onValueChange={handleThemeChange}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="system">
                                <div className="flex items-center gap-2">
                                  <Desktop weight="regular" className="h-3.5 w-3.5" />
                                  <span>System</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="light">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-4 w-4" />
                                  <span>Light</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="dark">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4" />
                                  <span>Dark</span>
                                </div>
                              </SelectItem>
                              {/* Nordic Themes */}
                              <SelectItem value="nordic-dark">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4 text-[#88C0D0]" />
                                  <span>Nordic Dark</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="nordic-light">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-4 w-4 text-[#5E81AC]" />
                                  <span>Nordic Light</span>
                                </div>
                              </SelectItem>
                              {/* Solarized Themes */}
                              <SelectItem value="solarized-dark">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4 text-[#268bd2]" />
                                  <span>Solarized Dark</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="solarized-light">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-4 w-4 text-[#b58900]" />
                                  <span>Solarized Light</span>
                                </div>
                              </SelectItem>
                              {/* Classic Themes */}
                              <SelectItem value="classic-light">
                                <div className="flex items-center gap-2">
                                  <Sun className="h-4 w-4 text-blue-500" />
                                  <span>Classic Light</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="classic-dark">
                                <div className="flex items-center gap-2">
                                  <Moon className="h-4 w-4 text-blue-400" />
                                  <span>Classic Dark</span>
                                </div>
                              </SelectItem>
                              {/* One Dark Theme */}
                              <SelectItem value="one-dark">
                                <div className="flex items-center gap-2">
                                  <Palette className="h-4 w-4 text-[#61afef]" />
                                  <span>One Dark</span>
                                </div>
                              </SelectItem>
                              {/* High Contrast Theme */}
                              <SelectItem value="high-contrast">
                                <div className="flex items-center gap-2">
                                  <Eye className="h-4 w-4 text-yellow-400" />
                                  <span>High Contrast</span>
                                </div>
                              </SelectItem>
                              {/* Custom Themes */}
                              {customThemes.length > 0 && (
                                <>
                                  <Separator className="my-1" />
                                  <div className="px-2 py-1 text-xs text-muted-foreground">
                                    Custom Themes
                                  </div>
                                  {customThemes.map((t) => (
                                    <SelectItem key={t.id} value={`custom:${t.id}`}>
                                      <div className="flex items-center gap-2">
                                        {t.baseTheme === "dark" ? (
                                          <Moon className="h-4 w-4 text-muted-foreground" />
                                        ) : (
                                          <Sun className="h-4 w-4 text-muted-foreground" />
                                        )}
                                        <span>{t.name}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </>
                              )}
                            </SelectContent>
                          </Select>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Density"
                          description="Row height and spacing in lists, menus, and the connection tree."
                        >
                          <Select value={density} onValueChange={(v) => setDensity(v as "compact" | "default" | "relaxed")}>
                            <SelectTrigger className="w-48">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="compact">Compact</SelectItem>
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="relaxed">Relaxed</SelectItem>
                            </SelectContent>
                          </Select>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Environment Accent"
                          description="Tint the accent color to the active connection's group color (e.g. red for Production)."
                        >
                          <Checkbox
                            checked={generalSettings.accentFollowsConnection ?? true}
                            onCheckedChange={(checked: boolean) =>
                              handleGeneralSettingChange("accentFollowsConnection", checked)
                            }
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Enable Animations"
                          description="Enable smooth animations throughout the interface."
                        >
                          <Checkbox
                            checked={generalSettings.enableAnimations}
                            onCheckedChange={(checked: boolean) =>
                              handleGeneralSettingChange("enableAnimations", checked)
                            }
                          />
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="Custom Themes"
                          description="Create, import, and manage custom color themes."
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowThemeManager(true)}
                          >
                            <Wrench weight="regular" className="h-3.5 w-3.5 mr-1.5" />
                            Manage Themes
                          </Button>
                        </SettingRow>
                        {customThemes.length > 0 && (
                          <>
                            <Separator />
                            <div className="py-3 px-1">
                              <p className="text-xs text-muted-foreground mb-2">
                                Your custom themes ({customThemes.length}):
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {customThemes.slice(0, 5).map((t) => (
                                  <span
                                    key={t.id}
                                    className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-muted"
                                  >
                                    {t.baseTheme === "dark" ? (
                                      <Moon className="h-3 w-3 mr-1 text-muted-foreground" />
                                    ) : (
                                      <Sun className="h-3 w-3 mr-1 text-muted-foreground" />
                                    )}
                                    {t.name}
                                  </span>
                                ))}
                                {customThemes.length > 5 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{customThemes.length - 5} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Keybindings Tab */}
                  {activeTab === "keybindings" && (
                    <KeybindingEditor />
                  )}

                  {/* Advanced Tab */}
                  {activeTab === "advanced" && (() => {
                    const { historySettings, updateHistorySettings, cleanupOldHistory } = useQueryStore.getState();

                    return (
                      <div className="space-y-4 animate-fade-in">
                        <div>
                          <h2 className="text-sm font-medium mb-0.5">Advanced</h2>
                          <p className="text-xs text-muted-foreground">Advanced settings for power users.</p>
                        </div>

                        <div className="rounded-md border border-border">
                          <SettingRow
                            label="Developer Mode"
                            description="Enable additional debugging information and console logging."
                          >
                            <Checkbox defaultChecked={false} />
                          </SettingRow>
                          <Separator />
                          <SettingRow
                            label="Debug Logging"
                            description="Log detailed information to help troubleshoot issues."
                          >
                            <Checkbox defaultChecked={false} />
                          </SettingRow>
                          <Separator />
                          <SettingRow
                            label="Reset all settings"
                            description="Restore all settings to their default values."
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: "Settings reset",
                                  description: "All settings have been reset to default values.",
                                });
                              }}
                            >
                              <ArrowCounterClockwise weight="regular" className="h-3.5 w-3.5 mr-1.5" />
                              Reset
                            </Button>
                          </SettingRow>
                          <Separator />
                          <SettingRow
                            label="Clear cache"
                            description="Clear cached data and temporary files."
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                toast({
                                  title: "Cache cleared",
                                  description: "All cached data has been cleared.",
                                });
                              }}
                            >
                              Clear Cache
                            </Button>
                          </SettingRow>
                        </div>

                        {/* Query History Settings */}
                        <div className="pt-2">
                          <h3 className="micro-label mb-1">Query History</h3>
                          <p className="text-[11px] text-muted-foreground mb-3">
                            Configure how query history is stored and cleaned up.
                          </p>
                        </div>

                        <div className="rounded-md border border-border">
                          <SettingRow
                            label="Auto-cleanup enabled"
                            description="Automatically remove old queries based on age and count limits."
                          >
                            <Checkbox
                              checked={historySettings.autoCleanupEnabled}
                              onCheckedChange={(checked: boolean) => {
                                updateHistorySettings({ autoCleanupEnabled: checked });
                                toast({
                                  title: checked ? "Auto-cleanup enabled" : "Auto-cleanup disabled",
                                  description: checked
                                    ? "Old queries will be automatically cleaned up."
                                    : "Query history will be kept indefinitely.",
                                });
                              }}
                            />
                          </SettingRow>
                          <Separator />
                          <SettingRow
                            label="Maximum history items"
                            description="Maximum number of queries to keep per connection."
                          >
                            <Input
                              type="number"
                              min="10"
                              max="1000"
                              value={historySettings.maxHistoryItems}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value >= 10) {
                                  updateHistorySettings({ maxHistoryItems: value });
                                }
                              }}
                              className="w-20"
                            />
                          </SettingRow>
                          <Separator />
                          <SettingRow
                            label="Delete queries older than (days)"
                            description="Automatically remove queries older than this many days."
                          >
                            <Input
                              type="number"
                              min="1"
                              max="365"
                              value={historySettings.maxDaysOld}
                              onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (!isNaN(value) && value > 0) {
                                  updateHistorySettings({ maxDaysOld: value });
                                }
                              }}
                              className="w-20"
                            />
                          </SettingRow>
                          <Separator />
                          <SettingRow
                            label="Run cleanup now"
                            description="Manually trigger history cleanup based on current settings."
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                cleanupOldHistory();
                                toast({
                                  title: "Cleanup complete",
                                  description: "Query history has been cleaned up.",
                                });
                              }}
                            >
                              Clean Up Now
                            </Button>
                          </SettingRow>
                          <div className="px-4 py-3 bg-muted/30">
                            <p className="text-xs text-muted-foreground">
                              <strong>Note:</strong> Favorited queries are never deleted during auto-cleanup.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* About Tab */}
                  {activeTab === "about" && (
                    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
                      <DbForDevsIcon className="mb-3 h-8 w-8 text-muted-foreground/50" />
                      <h2 className="text-base font-medium">dbfordevs</h2>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <Badge variant="info" className="rounded px-1.5 py-0 font-medium">v{version || "..."}</Badge>
                        <Badge variant="secondary" className="rounded px-1.5 py-0 font-medium">Alpha</Badge>
                      </div>

                      <p className="mt-4 max-w-xs text-xs leading-relaxed text-muted-foreground">
                        A lightweight database tool for developer workflows.
                      </p>

                      <div className="flex items-center justify-center gap-2 pt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={async () => {
                            try {
                              await open("https://github.com/danielss-dev/dbfordevs");
                            } catch (error) {
                              console.error("Failed to open URL:", error);
                            }
                          }}
                        >
                          <GithubLogo weight="regular" className="h-3.5 w-3.5" />
                          GitHub
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 gap-1.5 text-xs"
                          onClick={async () => {
                            try {
                              await open("https://www.dbfordevs.app/docs");
                            } catch (error) {
                              console.error("Failed to open URL:", error);
                            }
                          }}
                        >
                          <ArrowSquareOut weight="regular" className="h-3.5 w-3.5" />
                          Documentation
                        </Button>
                      </div>

                      <p className="mt-6 text-[11px] text-muted-foreground/70">
                        Tauri · React · Rust · 2026
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Theme Manager Dialog */}
    <ThemeManagerDialog
      open={showThemeManager}
      onOpenChange={setShowThemeManager}
    />
    </>
  );
}
