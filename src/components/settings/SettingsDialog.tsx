import {
  Dialog,
  DialogContent,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  ScrollArea,
  Button,
} from "@/components/ui";
import { useUIStore } from "@/stores";
import { useToast } from "@/hooks/useToast";
import { Monitor, Moon, Sun, Keyboard, User, Settings2, Code, Info, Database, ExternalLink, Github } from "lucide-react";
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

export function SettingsDialog() {
  const { showSettingsDialog, setShowSettingsDialog, theme, setTheme, appStyle, setAppStyle } = useUIStore();
  const { toast } = useToast();

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

  return (
    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden sm:rounded-xl h-[580px]">
        <Tabs defaultValue="appearance" className="flex h-full w-full">
          {/* Sidebar */}
          <div className="w-52 border-r border-border bg-muted/30 flex flex-col">
            <div className="p-5 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <Settings2 className="h-4 w-4 text-primary" />
                </div>
                <span className="font-semibold text-base">Settings</span>
              </div>
            </div>

            <ScrollArea className="flex-1 px-2">
              <TabsList className="flex flex-col h-auto bg-transparent w-full gap-0.5 p-0">
                <TabsTrigger
                  value="general"
                  className={cn(
                    "justify-start gap-3 w-full py-2.5 px-3 rounded-lg transition-all",
                    "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-accent/50"
                  )}
                >
                  <User className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className={cn(
                    "justify-start gap-3 w-full py-2.5 px-3 rounded-lg transition-all",
                    "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-accent/50"
                  )}
                >
                  <Sun className="h-4 w-4" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="editor"
                  className={cn(
                    "justify-start gap-3 w-full py-2.5 px-3 rounded-lg transition-all",
                    "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-accent/50"
                  )}
                >
                  <Code className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger
                  value="shortcuts"
                  className={cn(
                    "justify-start gap-3 w-full py-2.5 px-3 rounded-lg transition-all",
                    "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-accent/50"
                  )}
                >
                  <Keyboard className="h-4 w-4" />
                  Shortcuts
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className={cn(
                    "justify-start gap-3 w-full py-2.5 px-3 rounded-lg transition-all",
                    "data-[state=active]:bg-accent data-[state=active]:text-accent-foreground",
                    "data-[state=inactive]:text-muted-foreground data-[state=inactive]:hover:text-foreground data-[state=inactive]:hover:bg-accent/50"
                  )}
                >
                  <Info className="h-4 w-4" />
                  About
                </TabsTrigger>
              </TabsList>
            </ScrollArea>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col min-w-0 bg-background">
            <ScrollArea className="flex-1">
              <div className="p-8 max-w-xl">
                <TabsContent value="general" className="mt-0 space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">General</h2>
                    <p className="text-sm text-muted-foreground">Manage your application preferences.</p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-1">
                    <SettingRow
                      label="Auto-save queries"
                      description="Automatically save your SQL queries as you type."
                    >
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                        Coming soon
                      </span>
                    </SettingRow>
                    <Separator />
                    <SettingRow
                      label="Language"
                      description="Select the display language for the interface."
                    >
                      <span className="text-sm font-medium">English (US)</span>
                    </SettingRow>
                  </div>
                </TabsContent>

                <TabsContent value="appearance" className="mt-0 space-y-6 animate-fade-in">
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
                          <SelectValue placeholder="Select theme" />
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
                          <SelectValue placeholder="Select style" />
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
                    <Separator />
                    <Separator />
                    <SettingRow
                      label="Reduce motion"
                      description="Minimize the amount of animation in the UI."
                    >
                      <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1 rounded-md">
                        System Default
                      </span>
                    </SettingRow>
                  </div>
                </TabsContent>

                <TabsContent value="editor" className="mt-0 space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Editor</h2>
                    <p className="text-sm text-muted-foreground">Configure the SQL editor experience.</p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-1 opacity-60">
                    <SettingRow
                      label="Font Family"
                      description="The font used in the SQL editor."
                    >
                      <span className="text-sm font-mono">JetBrains Mono</span>
                    </SettingRow>
                    <Separator />
                    <SettingRow
                      label="Font Size"
                      description="Adjust the text size in the editor."
                    >
                      <span className="text-sm">14px</span>
                    </SettingRow>
                    <Separator />
                    <SettingRow
                      label="Line Numbers"
                      description="Toggle line numbers on the left side."
                    >
                      <span className="text-sm">Enabled</span>
                    </SettingRow>
                  </div>
                  <p className="text-xs text-muted-foreground text-center">
                    Editor settings will be configurable in a future update.
                  </p>
                </TabsContent>

                <TabsContent value="shortcuts" className="mt-0 space-y-6 animate-fade-in">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Keyboard Shortcuts</h2>
                    <p className="text-sm text-muted-foreground">Master dbfordevs with these handy keys.</p>
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4 divide-y divide-border">
                    <ShortcutItem label="Execute query" keys={["Cmd", "Enter"]} />
                    <ShortcutItem label="New connection" keys={["Cmd", "N"]} />
                    <ShortcutItem label="Open settings" keys={["Cmd", ","]} />
                    <ShortcutItem label="Toggle sidebar" keys={["Cmd", "B"]} />
                    <ShortcutItem label="New query tab" keys={["Cmd", "T"]} />
                    <ShortcutItem label="Close tab" keys={["Cmd", "W"]} />
                  </div>
                </TabsContent>

                <TabsContent value="about" className="mt-0 animate-fade-in">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="relative mb-6">
                      <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl" />
                      <div className="relative bg-primary/10 w-20 h-20 rounded-2xl flex items-center justify-center ring-8 ring-primary/5">
                        <Database className="h-10 w-10 text-primary" />
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">dbfordevs</h2>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="badge badge-info">v0.1.0</span>
                      <span className="badge bg-muted text-muted-foreground">Alpha</span>
                    </div>

                    <div className="mt-8 max-w-sm space-y-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        A modern, lightweight database management tool designed specifically for developer workflows.
                      </p>

                      <div className="flex items-center justify-center gap-3 pt-4">
                        <Button variant="outline" size="sm" className="gap-2">
                          <Github className="h-4 w-4" />
                          GitHub
                        </Button>
                        <Button variant="outline" size="sm" className="gap-2">
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
                </TabsContent>
              </div>
            </ScrollArea>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
