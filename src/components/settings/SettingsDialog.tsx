import {
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
import { useUIStore } from "@/stores";
import { useToast } from "@/hooks/useToast";
import { open } from "@tauri-apps/plugin-shell";
import { getVersion } from "@tauri-apps/api/app";
import { useEffect, useState, useMemo } from "react";
import {
  Monitor,
  Moon,
  Sun,
  Keyboard,
  User,
  Settings2,
  Code,
  Info,
  Database,
  ExternalLink,
  Github,
  Search,
  Download,
  Star,
  ShieldCheck,
  MessageSquare,
  Layout as LayoutIcon,
  RotateCcw,
  Settings,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingRowProps {
  label: string;
  description: string;
  children: React.ReactNode;
}

function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="space-y-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground max-w-[280px]">{description}</p>
      </div>
      {children}
    </div>
  );
}

interface ShortcutItemProps {
  label: string;
  keys: string[];
}

function ShortcutItem({ label, keys }: ShortcutItemProps) {
  return (
    <div className="flex items-center justify-between py-3 group">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1">
        {keys.map((key, idx) => (
          <span key={idx}>
            <kbd className="px-2 py-1 bg-muted rounded-md border border-border text-[11px] font-mono font-medium shadow-sm">
              {key}
            </kbd>
            {idx < keys.length - 1 && <span className="text-muted-foreground mx-0.5">+</span>}
          </span>
        ))}
      </div>
    </div>
  );
}

interface PluginData {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  category: "Validators" | "AI" | "Exporters" | "Themes";
  downloads: string;
  rating: number;
  isOfficial: boolean;
  isFeatured?: boolean;
}

const PLUGINS: PluginData[] = [
  {
    id: "validator-csharp",
    name: "C# / .NET Validator",
    description: "Validate ADO.NET connection strings for SQL Server, PostgreSQL, and MySQL.",
    version: "1.0.2",
    author: "dbfordevs",
    category: "Validators",
    downloads: "1.2k",
    rating: 4.8,
    isOfficial: true,
  },
  {
    id: "validator-nodejs",
    name: "Node.js Validator",
    description: "Support for pg, mysql2, and mssql connection string formats (URL and JSON).",
    version: "1.1.0",
    author: "dbfordevs",
    category: "Validators",
    downloads: "2.5k",
    rating: 4.9,
    isOfficial: true,
  },
  {
    id: "validator-python",
    name: "Python Validator",
    description: "SQLAlchemy, psycopg2, and PyMySQL connection URL validation.",
    version: "1.0.5",
    author: "dbfordevs",
    category: "Validators",
    downloads: "800",
    rating: 4.7,
    isOfficial: true,
  },
  {
    id: "ai-assistant",
    name: "AI Query Assistant",
    description: "Generate SQL from natural language, optimize slow queries, and explain plans.",
    version: "2.0.1",
    author: "dbfordevs",
    category: "AI",
    downloads: "5.4k",
    rating: 5.0,
    isOfficial: true,
    isFeatured: true,
  },
  {
    id: "exporter-parquet",
    name: "Parquet Exporter",
    description: "Export result sets to Apache Parquet format for big data processing.",
    version: "0.9.0",
    author: "Community",
    category: "Exporters",
    downloads: "300",
    rating: 4.5,
    isOfficial: false,
  },
  {
    id: "theme-nord",
    name: "Nord Theme",
    description: "An arctic, north-bluish color palette for dbfordevs.",
    version: "1.0.0",
    author: "Arctic Ice Studio",
    category: "Themes",
    downloads: "1.5k",
    rating: 4.8,
    isOfficial: false,
  },
];

type TabValue = "general" | "editor" | "appearance" | "extensions" | "keybindings" | "advanced" | "about";

interface TabConfig {
  value: TabValue;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  { value: "general", label: "General", icon: <User className="h-4 w-4" /> },
  { value: "editor", label: "Editor", icon: <Code className="h-4 w-4" /> },
  { value: "appearance", label: "Appearance", icon: <Sun className="h-4 w-4" /> },
  { value: "extensions", label: "Extensions", icon: <Layers className="h-4 w-4" /> },
  { value: "keybindings", label: "Keybindings", icon: <Keyboard className="h-4 w-4" /> },
  { value: "advanced", label: "Advanced", icon: <Settings className="h-4 w-4" /> },
  { value: "about", label: "About", icon: <Info className="h-4 w-4" /> },
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
  // Appearance
  { label: "Theme", description: "Switch between light, dark, or system theme.", keywords: ["theme", "light", "dark", "system", "color"], tabValue: "appearance" },
  { label: "App Style", description: "Choose between a developer-focused IDE style or a modern web look.", keywords: ["style", "app", "developer", "web", "ide"], tabValue: "appearance" },
  // Extensions
  { label: "Extensions", description: "Extend dbfordevs with plugins and integrations.", keywords: ["extension", "plugin", "marketplace", "install"], tabValue: "extensions" },
  // Keybindings
  { label: "Keyboard Shortcuts", description: "Master dbfordevs with these handy keys.", keywords: ["keyboard", "shortcut", "key", "binding"], tabValue: "keybindings" },
  // Advanced
  { label: "Developer Mode", description: "Enable additional debugging information and console logging.", keywords: ["developer", "debug", "mode", "console"], tabValue: "advanced" },
  { label: "Debug Logging", description: "Log detailed information to help troubleshoot issues.", keywords: ["debug", "log", "logging", "troubleshoot"], tabValue: "advanced" },
  { label: "Reset all settings", description: "Restore all settings to their default values.", keywords: ["reset", "default", "restore"], tabValue: "advanced" },
  { label: "Clear cache", description: "Clear cached data and temporary files.", keywords: ["cache", "clear", "temporary", "files"], tabValue: "advanced" },
];

function PluginCard({ plugin }: { plugin: PluginData }) {
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "AI":
        return <MessageSquare className="h-6 w-6 text-primary" />;
      case "Validators":
        return <ShieldCheck className="h-6 w-6 text-primary" />;
      case "Themes":
        return <LayoutIcon className="h-6 w-6 text-primary" />;
      default:
        return <Database className="h-6 w-6 text-primary" />;
    }
  };

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-background p-5 transition-all hover:border-primary/50 hover:shadow-md">
      <div className="mb-4 flex items-start justify-between">
        <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/5">
          {getCategoryIcon(plugin.category)}
        </div>
        {plugin.isFeatured && (
          <span className="badge badge-primary bg-primary/10 text-primary hover:bg-primary/20 text-[10px]">
            Featured
          </span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-sm">{plugin.name}</h4>
          {plugin.isOfficial && (
            <span className="badge badge-outline h-5 px-1.5 text-[10px] uppercase font-bold tracking-tighter bg-primary/5 text-primary border-primary/20">
              Official
            </span>
          )}
        </div>
        <p className="mb-4 text-xs text-muted-foreground line-clamp-2">{plugin.description}</p>
      </div>
      <div className="mt-auto pt-4 border-t border-border/50">
        <div className="mb-4 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
              {plugin.rating}
            </span>
            <span className="flex items-center gap-1">
              <Download className="h-3 w-3" />
              {plugin.downloads}
            </span>
          </div>
          <span className="font-mono">v{plugin.version}</span>
        </div>
        <Button className="w-full" size="sm">
          <Download className="mr-2 h-4 w-4" />
          Install
        </Button>
      </div>
    </div>
  );
}

export function SettingsDialog() {
  const {
    showSettingsDialog,
    setShowSettingsDialog,
    theme,
    setTheme,
    appStyle,
    setAppStyle,
    editorSettings,
    updateEditorSettings,
    generalSettings,
    updateGeneralSettings,
    settingsDialogTab,
  } = useUIStore();
  const { toast } = useToast();
  const [version, setVersion] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabValue>(settingsDialogTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [pluginSearch, setPluginSearch] = useState("");
  const [pluginCategory, setPluginCategory] = useState("all");

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

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    toast({
      title: "Theme updated",
      description: `Interface theme set to ${newTheme}.`,
    });
  };

  const handleAppStyleChange = (newStyle: "developer" | "web") => {
    setAppStyle(newStyle);
    toast({
      title: "App style updated",
      description: `Application style set to ${newStyle}.`,
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

  const filteredPlugins = useMemo(() => {
    return PLUGINS.filter((plugin) => {
      const matchesSearch = plugin.name.toLowerCase().includes(pluginSearch.toLowerCase()) ||
        plugin.description.toLowerCase().includes(pluginSearch.toLowerCase());
      const matchesCategory = pluginCategory === "all" || plugin.category.toLowerCase() === pluginCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });
  }, [pluginSearch, pluginCategory]);

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
    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <DialogContent className="max-w-5xl gap-0 p-0 overflow-hidden sm:rounded-xl h-[700px]">
        <div className="flex h-full w-full flex-col overflow-hidden">
          {/* Header */}
          <div className="border-b border-border bg-background/80 backdrop-blur-sm px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                <Settings2 className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-xl font-semibold">Settings</h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Sidebar Navigation */}
            <div className="w-56 border-r border-border bg-muted/30 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1 px-2 py-4">
                <nav className="space-y-0.5">
                  {filteredTabs.map((tab) => (
                    <button
                      key={tab.value}
                      onClick={() => {
                        setActiveTab(tab.value);
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm font-medium justify-start",
                        activeTab === tab.value
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                      )}
                    >
                      {tab.icon}
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </ScrollArea>

              {/* Search in sidebar footer */}
              <div className="border-t border-border bg-muted/50 p-3">
                {searchOpen ? (
                  <div className="relative flex items-center gap-2">
                    <Input
                      placeholder="Search settings..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      autoFocus
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSearchOpen(false);
                        setSearchQuery("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full justify-start gap-2 h-8 text-xs"
                    onClick={() => setSearchOpen(true)}
                  >
                    <Search className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">Search...</span>
                    <kbd className="text-[10px] text-muted-foreground">Cmd+F</kbd>
                  </Button>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <ScrollArea className="flex-1">
                <div className="p-8 max-w-2xl">
                  {/* General Tab */}
                  {activeTab === "general" && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">General</h2>
                        <p className="text-sm text-muted-foreground">Manage your application preferences.</p>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-1">
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
                  )}

                  {/* Editor Tab */}
                  {activeTab === "editor" && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">Editor</h2>
                        <p className="text-sm text-muted-foreground">Configure the SQL editor experience.</p>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-1">
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
                    </div>
                  )}

                  {/* Appearance Tab */}
                  {activeTab === "appearance" && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">Appearance</h2>
                        <p className="text-sm text-muted-foreground">Customize how dbfordevs looks on your screen.</p>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-1">
                        <SettingRow
                          label="Theme"
                          description="Switch between light, dark, or system theme."
                        >
                          <Select value={theme} onValueChange={handleThemeChange}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="system">
                                <div className="flex items-center gap-2">
                                  <Monitor className="h-4 w-4" />
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
                            </SelectContent>
                          </Select>
                        </SettingRow>
                        <Separator />
                        <SettingRow
                          label="App Style"
                          description="Choose between a developer-focused IDE style or a modern web look."
                        >
                          <Select value={appStyle} onValueChange={handleAppStyleChange}>
                            <SelectTrigger className="w-40">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="developer">
                                <div className="flex items-center gap-2">
                                  <Code className="h-4 w-4" />
                                  <span>Developer</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="web">
                                <div className="flex items-center gap-2">
                                  <Database className="h-4 w-4" />
                                  <span>Web</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </SettingRow>
                      </div>
                    </div>
                  )}

                  {/* Extensions Tab */}
                  {activeTab === "extensions" && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">Extensions</h2>
                        <p className="text-sm text-muted-foreground">Extend dbfordevs with plugins and integrations.</p>
                      </div>

                      {/* Search & Filters */}
                      <div className="space-y-4">
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Search extensions..."
                            className="pl-10"
                            value={pluginSearch}
                            onChange={(e) => setPluginSearch(e.target.value)}
                          />
                        </div>

                        {/* Category Tabs */}
                        <div className="flex gap-2 flex-wrap">
                          {["all", "validators", "ai", "exporters", "themes"].map((cat) => (
                            <button
                              key={cat}
                              onClick={() => setPluginCategory(cat)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                pluginCategory === cat
                                  ? "bg-primary text-primary-foreground"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              )}
                            >
                              {cat.charAt(0).toUpperCase() + cat.slice(1)}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Plugin Grid */}
                      <div className="grid grid-cols-1 gap-4">
                        {filteredPlugins.length > 0 ? (
                          filteredPlugins.map((plugin) => <PluginCard key={plugin.id} plugin={plugin} />)
                        ) : (
                          <div className="text-center py-12">
                            <p className="text-sm text-muted-foreground">No extensions found.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Keybindings Tab */}
                  {activeTab === "keybindings" && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">Keyboard Shortcuts</h2>
                        <p className="text-sm text-muted-foreground">Master dbfordevs with these handy keys.</p>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-4 divide-y divide-border">
                        <ShortcutItem label="Execute query" keys={["Cmd", "Enter"]} />
                        <ShortcutItem label="New connection" keys={["Cmd", "K"]} />
                        <ShortcutItem label="Open settings" keys={["Cmd", ","]} />
                        <ShortcutItem label="Toggle sidebar" keys={["Cmd", "B"]} />
                        <ShortcutItem label="New query tab" keys={["Cmd", "T"]} />
                        <ShortcutItem label="Close tab" keys={["Cmd", "W"]} />
                        <ShortcutItem label="View changes diff" keys={["Cmd", "Shift", "D"]} />
                        <ShortcutItem label="Toggle fullscreen" keys={["F11"]} />
                        <ShortcutItem label="Format query" keys={["Cmd", "Shift", "F"]} />
                        <ShortcutItem label="Find" keys={["Cmd", "F"]} />
                        <ShortcutItem label="Replace" keys={["Cmd", "H"]} />
                        <ShortcutItem label="Search settings" keys={["Cmd", "F"]} />
                        <ShortcutItem label="Close dialogs" keys={["Esc"]} />
                      </div>
                    </div>
                  )}

                  {/* Advanced Tab */}
                  {activeTab === "advanced" && (
                    <div className="space-y-6 animate-fade-in">
                      <div>
                        <h2 className="text-xl font-semibold mb-1">Advanced</h2>
                        <p className="text-sm text-muted-foreground">Advanced settings for power users.</p>
                      </div>

                      <div className="rounded-xl border border-border bg-card p-1">
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
                            <RotateCcw className="h-4 w-4 mr-2" />
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
                    </div>
                  )}

                  {/* About Tab */}
                  {activeTab === "about" && (
                    <div className="flex flex-col items-center justify-center py-12 text-center animate-fade-in">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
                        <div className="relative bg-primary/10 w-20 h-20 rounded-2xl flex items-center justify-center ring-8 ring-primary/5">
                          <Database className="h-10 w-10 text-primary" />
                        </div>
                      </div>
                      <h2 className="text-2xl font-bold tracking-tight">dbfordevs</h2>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="badge badge-info">v{version || "..."}</span>
                        <span className="badge bg-muted text-muted-foreground">Alpha</span>
                      </div>

                      <div className="mt-8 max-w-sm space-y-4">
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          A modern, lightweight database management tool designed specifically for developer workflows.
                        </p>

                        <div className="flex items-center justify-center gap-3 pt-4">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={async () => {
                              try {
                                await open("https://github.com/danielss-dev/dbfordevs");
                              } catch (error) {
                                console.error("Failed to open URL:", error);
                              }
                            }}
                          >
                            <Github className="h-4 w-4" />
                            GitHub
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={async () => {
                              try {
                                await open("https://www.dbfordevs.app/docs");
                              } catch (error) {
                                console.error("Failed to open URL:", error);
                              }
                            }}
                          >
                            <ExternalLink className="h-4 w-4" />
                            Documentation
                          </Button>
                        </div>

                        <Separator className="my-6" />

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>Built with Tauri, React, and Rust</p>
                          <p className="text-muted-foreground/60">2025 dbfordevs Team</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
