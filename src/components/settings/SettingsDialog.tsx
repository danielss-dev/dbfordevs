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
} from "@/components/ui";
import { useUIStore } from "@/stores";
import { Monitor, Moon, Sun, Keyboard, User, Settings2, Code, Info } from "lucide-react";

export function SettingsDialog() {
  const { showSettingsDialog, setShowSettingsDialog, theme, setTheme } = useUIStore();

  return (
    <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
      <DialogContent className="max-w-3xl gap-0 p-0 overflow-hidden sm:rounded-xl h-[550px]">
        <Tabs defaultValue="appearance" className="flex h-full w-full">
          {/* Sidebar */}
          <div className="w-56 border-r bg-muted/20 flex flex-col">
            <div className="p-6 pb-4">
              <div className="flex items-center gap-2 text-primary">
                <Settings2 className="h-5 w-5" />
                <span className="font-bold text-lg tracking-tight">Settings</span>
              </div>
            </div>
            
            <ScrollArea className="flex-1 px-3">
              <TabsList className="flex flex-col h-auto bg-transparent w-full gap-1 p-0">
                <TabsTrigger
                  value="general"
                  className="justify-start gap-3 w-full py-2.5 px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg transition-all"
                >
                  <User className="h-4 w-4" />
                  General
                </TabsTrigger>
                <TabsTrigger
                  value="appearance"
                  className="justify-start gap-3 w-full py-2.5 px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg transition-all"
                >
                  <Sun className="h-4 w-4" />
                  Appearance
                </TabsTrigger>
                <TabsTrigger
                  value="editor"
                  className="justify-start gap-3 w-full py-2.5 px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg transition-all"
                >
                  <Code className="h-4 w-4" />
                  Editor
                </TabsTrigger>
                <TabsTrigger
                  value="shortcuts"
                  className="justify-start gap-3 w-full py-2.5 px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg transition-all"
                >
                  <Keyboard className="h-4 w-4" />
                  Shortcuts
                </TabsTrigger>
                <TabsTrigger
                  value="about"
                  className="justify-start gap-3 w-full py-2.5 px-3 data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg transition-all"
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
                <TabsContent value="general" className="mt-0 space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">General</h2>
                    <p className="text-sm text-muted-foreground mb-6">Manage your application preferences.</p>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Auto-save queries</Label>
                          <p className="text-[12px] text-muted-foreground">Automatically save your SQL queries as you type.</p>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Coming soon</div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Language</Label>
                          <p className="text-[12px] text-muted-foreground">Select the display language for the interface.</p>
                        </div>
                        <div className="text-sm font-medium">English (US)</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="appearance" className="mt-0 space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Appearance</h2>
                    <p className="text-sm text-muted-foreground mb-6">Customize how dbfordevs looks on your screen.</p>
                    
                    <div className="space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Application Theme</Label>
                          <p className="text-[12px] text-muted-foreground">
                            Switch between light, dark, or system theme.
                          </p>
                        </div>
                        <Select value={theme} onValueChange={(v: any) => setTheme(v)}>
                          <SelectTrigger className="w-36">
                            <SelectValue placeholder="Select theme" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="system">
                              <div className="flex items-center gap-2">
                                <Monitor className="h-3.5 w-3.5" />
                                <span>System</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="light">
                              <div className="flex items-center gap-2">
                                <Sun className="h-3.5 w-3.5" />
                                <span>Light</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="dark">
                              <div className="flex items-center gap-2">
                                <Moon className="h-3.5 w-3.5" />
                                <span>Dark</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Reduce motion</Label>
                          <p className="text-[12px] text-muted-foreground">Minimize the amount of animation in the UI.</p>
                        </div>
                        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">System Default</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="editor" className="mt-0 space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Editor</h2>
                    <p className="text-sm text-muted-foreground mb-6">Configure the SQL editor experience.</p>
                    
                    <div className="space-y-6 opacity-60">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Font Family</Label>
                          <p className="text-[12px] text-muted-foreground">The font used in the SQL editor.</p>
                        </div>
                        <div className="text-sm font-mono">JetBrains Mono</div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Font Size</Label>
                          <p className="text-[12px] text-muted-foreground">Adjust the text size in the editor.</p>
                        </div>
                        <div className="text-sm">14px</div>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <Label>Line Numbers</Label>
                          <p className="text-[12px] text-muted-foreground">Toggle line numbers on the left side.</p>
                        </div>
                        <div className="text-sm">Enabled</div>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="shortcuts" className="mt-0 space-y-8">
                  <div>
                    <h2 className="text-xl font-semibold mb-1">Keyboard Shortcuts</h2>
                    <p className="text-sm text-muted-foreground mb-6">Master dbfordevs with these handy keys.</p>
                    
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">Execute current query</span>
                        <kbd className="px-2 py-1 bg-muted rounded-md border text-[11px] font-mono shadow-sm">⌘ + Enter</kbd>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">New database connection</span>
                        <kbd className="px-2 py-1 bg-muted rounded-md border text-[11px] font-mono shadow-sm">⌘ + N</kbd>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">Open settings</span>
                        <kbd className="px-2 py-1 bg-muted rounded-md border text-[11px] font-mono shadow-sm">⌘ + ,</kbd>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-sm">Toggle sidebar</span>
                        <kbd className="px-2 py-1 bg-muted rounded-md border text-[11px] font-mono shadow-sm">⌘ + B</kbd>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="about" className="mt-0 space-y-8">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="bg-primary/10 w-20 h-20 rounded-3xl flex items-center justify-center mb-6 ring-8 ring-primary/5">
                      <Settings2 className="h-10 w-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">dbfordevs</h2>
                    <p className="text-sm text-muted-foreground mt-1">Version 0.1.0 (Alpha)</p>
                    
                    <div className="mt-10 max-w-sm space-y-4">
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        A modern, lightweight database management tool designed specifically for developer workflows.
                      </p>
                      <div className="pt-4 flex items-center justify-center gap-4">
                        <div className="h-px w-8 bg-border" />
                        <span className="text-[10px] uppercase tracking-widest font-semibold text-muted-foreground/50">Details</span>
                        <div className="h-px w-8 bg-border" />
                      </div>
                      <div className="text-xs text-muted-foreground/70 space-y-1">
                        <p>Built with Tauri, React, and Rust</p>
                        <p>© 2025 dbfordevs Team</p>
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
